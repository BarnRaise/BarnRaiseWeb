import { useLazyQuery } from '@airstack/airstack-react';
import {
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { SocialQuery } from '../../queries';
import { SectionHeader } from './SectionHeader';
import { SocialsType } from './types';
import { Modal } from '../../Components/Modal';
import classNames from 'classnames';
import { useSearchInput } from '../../hooks/useSearchInput';
import { Icon } from '../../Components/Icon';

type SocialType = SocialsType['Wallet'];
type SocialProps = {
  name: string;
  values: ReactNode[];
  image: string;
  onShowMore?: () => void;
};

const maxSocials = 7;
const minSocials = 2;

const imagesMap: Record<string, string> = {
  lens: '/images/lens.svg',
  farcaster: '/images/farcaster.svg',
  xmtp: '/images/xmtp.svg',
  ens: '/images/ens.svg'
};

function Social({ name, values, image, onShowMore }: SocialProps) {
  const [showMax, setShowMax] = useState(false);
  const items = useMemo(() => {
    if (!showMax) {
      return values?.slice(0, minSocials);
    }
    return values?.slice(0, maxSocials);
  }, [showMax, values]);

  return (
    <div className="flex text-sm mb-7 last:mb-0">
      <div className="flex flex-1 items-start">
        <div className="flex items-center">
          <div className="rounded-full h-[25px] w-[25px] border mr-2 overflow-hidden flex-row-center">
            <img src={image} className="w-full" />
          </div>
          <span className="first-letter:uppercase">{name}</span>
        </div>
      </div>
      <ul className="text-text-secondary w-1/2 overflow-hidden flex flex-col justify-center">
        {items?.map((value, index) => (
          <li
            key={index}
            className="overflow-ellipsis whitespace-nowrap overflow-hidden mb-2.5 last:mb-0"
          >
            {value}
          </li>
        ))}
        {!showMax && values?.length > minSocials && (
          <li
            onClick={() => {
              setShowMax(show => !show);
            }}
            className="text-text-button font-bold cursor-pointer"
          >
            see more
          </li>
        )}
        {showMax && values.length > maxSocials && (
          <li
            onClick={() => {
              if (showMax && values.length > maxSocials) {
                onShowMore?.();
                return;
              }
            }}
            className="text-text-button font-bold cursor-pointer"
          >
            see all
          </li>
        )}
      </ul>
    </div>
  );
}

function XMTP() {
  return (
    <span className="flex items-center">
      <Icon name="xmtp" height={14} width={14} />
      <span className="ml-1 mb-1">enabled</span>
    </span>
  );
}

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
  const { address: owner } = useSearchInput();

  const socialDetails = (data?.Wallet || {}) as SocialType;

  useEffect(() => {
    if (owner) {
      fetch({
        identity: owner
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
      <Modal
        heading="All ENS names of vitalik.eth"
        isOpen={showModal}
        onRequestClose={() => {
          setShowModal(false);
          setModalValues({
            leftValues: [],
            rightValues: []
          });
        }}
      >
        <div className="w-[600px] max-h-[60vh] h-auto bg-primary rounded-xl p-5 overflow-auto flex">
          <div className="flex-1">
            {modalValues.leftValues.map((value, index) => (
              <div className="mb-8" key={index}>
                {value}
              </div>
            ))}
          </div>
          <div className="border-l border-solid border-stroke-color flex-1 pl-5">
            {modalValues.rightValues.map((value, index) => (
              <div className="mb-8" key={index}>
                {value}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export const Socials = memo(SocialsComponent);
