import { useLazyQuery } from '@airstack/airstack-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { SocialQuery } from '../../../queries';
import { SectionHeader } from '../SectionHeader';
import { SocialsType } from '../types';
import classNames from 'classnames';
import { useSearchInput } from '../../../hooks/useSearchInput';
import { Social } from './Social';
import { XMTP } from './XMTP';
import { AddressesModal } from '../../../Components/AddressesModal';

type SocialType = SocialsType['Wallet'];
const imagesMap: Record<string, string> = {
  lens: '/images/lens.svg',
  farcaster: '/images/farcaster.svg',
  xmtp: '/images/xmtp.svg',
  ens: '/images/ens.svg'
};
function SocialsComponent() {
  const [modalValues, setModalValues] = useState<{
    leftValues: string[];
    rightValues: string[];
  }>({
    leftValues: [],
    rightValues: []
  });
  const [showModal, setShowModal] = useState(false);
  const [fetch, { data, loading }] = useLazyQuery(SocialQuery);
  const [{ address: owner }, setData] = useSearchInput();

  const socialDetails = (data?.Wallet || {}) as SocialType;

  useEffect(() => {
    if (owner.length > 0) {
      fetch({
        identity: owner[0]
      });
    }
  }, [fetch, owner]);

  const domainsList = useMemo(
    () => socialDetails?.domains?.map(({ name }) => name),
    [socialDetails?.domains]
  );

  const xmtpEnabled = useMemo(
    () => socialDetails?.xmtp?.find(({ isXMTPEnabled }) => isXMTPEnabled),
    [socialDetails?.xmtp]
  );

  const handleShowMore = useCallback((values: string[]) => {
    const leftValues: string[] = [];
    const rightValues: string[] = [];
    values.forEach((value, index) => {
      if (index % 2 === 0) {
        leftValues.push(value);
      } else {
        rightValues.push(value);
      }
    });
    setModalValues({
      leftValues,
      rightValues
    });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setModalValues({
      leftValues: [],
      rightValues: []
    });
  }, []);

  const handleAddressClick = useCallback(
    (value: string) => {
      setData(
        {
          rawInput: value,
          address: [value],
          inputType: 'ADDRESS'
        },
        { updateQueryParams: true }
      );
      closeModal();
    },
    [closeModal, setData]
  );

  const socials = useMemo(() => {
    const _socials = socialDetails?.socials || [];

    type Social = SocialType['socials'][0] & {
      profileNames?: string[];
    };

    const map: Record<string, Social> = {};

    _socials.forEach(social => {
      const existing = map[social.dappName];
      if (existing) {
        existing.profileNames?.push(social.profileName);
        return;
      } else {
        map[social.dappName] = {
          ...social,
          profileNames: [social.profileName]
        };
      }
    });

    if (!map['farcaster']) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      map['farcaster'] = { dappName: 'farcaster', profileNames: ['--'] };
    }

    if (!map['lens']) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      map['lens'] = { dappName: 'lens', profileNames: ['--'] };
    }
    return Object.values(map);
  }, [socialDetails?.socials]);

  return (
    <div className="w-full sm:w-auto">
      <div className="hidden sm:block">
        <SectionHeader iconName="socials-flat" heading="Socials" />
      </div>
      <div
        className={classNames(
          'rounded-18  border-solid-stroke mt-3.5 min-h-[250px] flex flex-col bg-glass',
          {
            'skeleton-loader': loading
          }
        )}
      >
        <div
          data-loader-type="block"
          data-loader-height="auto"
          className="h-full p-5 flex-1"
        >
          <Social
            name="Primary ENS"
            values={[socialDetails?.primaryDomain?.name || '--']}
            image={imagesMap['ens']}
          />
          <Social
            name="ENS names"
            values={
              domainsList && domainsList.length > 0 ? domainsList : ['--']
            }
            onShowMore={() => {
              handleShowMore(domainsList || []);
            }}
            image={imagesMap['ens']}
          />
          {socials.map(({ dappName, profileName, profileNames }) => (
            <Social
              name={dappName}
              values={profileNames || [profileName]}
              image={imagesMap[dappName?.trim()]}
            />
          ))}
          <Social
            name="XMTP"
            values={xmtpEnabled ? [<XMTP />] : ['--']}
            image={imagesMap['xmtp']}
          />
        </div>
      </div>
      <AddressesModal
        heading="All ENS names of vitalik.eth"
        isOpen={showModal}
        onRequestClose={closeModal}
        modalValues={modalValues}
        onAddressClick={handleAddressClick}
      />
    </div>
  );
}

export const Socials = memo(SocialsComponent);
