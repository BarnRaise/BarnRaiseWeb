import {
  ComponentProps,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useSearchInput } from '../../../../hooks/useSearchInput';
import { Modal } from '../../../../Components/Modal';
import { useLazyQueryWithPagination } from '@airstack/airstack-react';
import { Header } from './Header';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Poap, Token as TokenType, TokensData } from '../../types';
import { filterTokens, getRequestFilters } from './filters';
import { Token } from './Token';
import classNames from 'classnames';
import { StatusLoader } from './StatusLoader';
import { useLoaderContext } from '../../../../hooks/useLoader';
import { getFilterablePoapsQuery } from '../../../../queries/overviewDetailsPoap';
import {
  getCommonNftOwnersQueryWithFilters,
  getNftOwnersQueryWithFilters
} from '../../../../queries/commonNftOwnersQueryWithFilters';
import { getCommonPoapAndNftOwnersQueryWithFilters } from '../../../../queries/commonPoapAndNftOwnersQueryWithFilters';
import { sortByAddressByNonERC20First } from '../../../../utils/getNFTQueryForTokensHolder';
import { useOverviewTokens } from '../../../../store/tokenHoldersOverview';
import { getPoapList, getTokenList } from './utils';
import { sortAddressByPoapFirst } from '../../../../utils/sortAddressByPoapFirst';

const LIMIT = 200;
const MIN_LIMIT = 20;

const loaderData = Array(6).fill({});

type TableRowProps = ComponentProps<'tr'> & {
  isLoader?: boolean;
};

function TableRow({ isLoader, children, ...props }: TableRowProps) {
  return (
    <tr
      className={classNames(
        '[&>td]:px-8 [&>td]:py-5 [&>td]:align-middle min-h-[54px]',
        {
          'skeleton-loader [&>td:last-child]:hidden': isLoader,
          '[&>div>td]:px-8 [&>div>td]:py-5': isLoader
        }
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

function Loader() {
  return (
    <table className="w-auto text-xs table-fixed sm:w-full">
      <tbody>
        {loaderData.map((_, index) => (
          <TableRow isLoader={true} key={index}>
            <div data-loader-type="block" data-loader-margin="10">
              <Token token={null} />
            </div>
          </TableRow>
        ))}
      </tbody>
    </table>
  );
}

// function sortArray(array: TokenAddress[]) {
//   const startsWith0x: TokenAddress[] = [];
//   const notStartsWith0x: TokenAddress[] = [];

//   for (const item of array) {
//     if (item.address.startsWith('0x')) {
//       startsWith0x.push(item);
//     } else {
//       notStartsWith0x.push(item);
//     }
//   }

//   return [...notStartsWith0x, ...startsWith0x];
// }

export function TokensComponent() {
  const ownersSetRef = useRef<Set<string>>(new Set());
  const [tokens, setTokens] = useState<(TokenType | Poap)[]>([]);
  const tokensRef = useRef<(TokenType | Poap)[]>([]);
  const [{ tokens: overviewTokens }] = useOverviewTokens(['tokens']);
  const [{ tokenFilters: filters, address: tokenAddress, activeViewToken }] =
    useSearchInput();
  const [showStatusLoader, setShowStatusLoader] = useState(false);
  const [loaderStats, setLoaderStats] = useState({
    total: LIMIT,
    matching: 0
  });

  const requestFilters = useMemo(() => {
    return getRequestFilters(filters);
  }, [filters]);

  const hasSomePoap = tokenAddress.some(token => !token.startsWith('0x'));
  const hasPoap = tokenAddress.every(token => !token.startsWith('0x'));

  const address = useMemo(() => {
    return sortByAddressByNonERC20First(tokenAddress, overviewTokens, hasPoap);
  }, [hasPoap, tokenAddress, overviewTokens]);

  const tokensQuery = useMemo(() => {
    if (address.length === 0) return '';

    if (address.length === 1) {
      return getNftOwnersQueryWithFilters(
        address[0].address,
        Boolean(requestFilters?.socialFilters),
        requestFilters?.hasPrimaryDomain
      );
    }
    if (hasSomePoap) {
      const tokens = sortAddressByPoapFirst(address);
      return getCommonPoapAndNftOwnersQueryWithFilters(
        tokens[0],
        tokens[1],
        Boolean(requestFilters?.socialFilters),
        requestFilters?.hasPrimaryDomain
      );
    }
    return getCommonNftOwnersQueryWithFilters(
      address[0],
      address[1],
      Boolean(requestFilters?.socialFilters),
      requestFilters?.hasPrimaryDomain
    );
  }, [address, hasSomePoap, requestFilters]);

  const poapsQuery = useMemo(() => {
    return getFilterablePoapsQuery(
      address,
      Boolean(requestFilters?.socialFilters),
      requestFilters?.hasPrimaryDomain
    );
  }, [
    address,
    requestFilters?.hasPrimaryDomain,
    requestFilters?.socialFilters
  ]);

  const shouldFetchTokens = address.length > 0;
  const hasMultipleTokens = address.length > 1;

  const handleData = useCallback(
    (tokensData: TokensData) => {
      if (!tokensData) return;
      const [tokens, size] = hasPoap
        ? getPoapList(tokensData, hasMultipleTokens)
        : getTokenList(tokensData, hasMultipleTokens, hasSomePoap);

      let filteredTokens = filterTokens(filters, tokens);
      filteredTokens = filteredTokens.filter(token => {
        const address = token?.owner?.identity;
        if (!address) return false;
        if (ownersSetRef.current.has(address)) return false;
        ownersSetRef.current.add(address);
        return true;
      });

      setLoaderStats(({ total, matching }) => ({
        total: total + (size || 0),
        matching: matching + filteredTokens.length
      }));
      tokensRef.current = [...tokensRef.current, ...filteredTokens];
      setTokens(existingTokens => [...existingTokens, ...filteredTokens]);
    },
    [filters, hasMultipleTokens, hasPoap, hasSomePoap]
  );

  const [
    fetchTokens,
    { data, loading: loadingTokens, pagination: paginationTokens }
  ] = useLazyQueryWithPagination(
    tokensQuery,
    {},
    {
      onCompleted: handleData
    }
  );

  const [
    fetchPoap,
    { data: poapsData, loading: loadingPoaps, pagination: paginationPoaps }
  ] = useLazyQueryWithPagination(
    poapsQuery,
    {},
    {
      onCompleted: handleData
    }
  );

  // save data to tokensData and user if further so, if we apply filter we can set this to null,
  // and fetch next data call will not be made
  let tokensData = data || poapsData || null;

  const [showModal, setShowModal] = useState(false);
  const [modalValues, setModalValues] = useState<{
    leftValues: string[];
    rightValues: string[];
    dataType: string;
  }>({
    leftValues: [],
    rightValues: [],
    dataType: ''
  });

  useEffect(() => {
    if (shouldFetchTokens) {
      // eslint-disable-next-line
      tokensData = null;
      tokensRef.current = [];
      ownersSetRef.current = new Set();
      setTokens([]);
      setShowStatusLoader(true);
      setLoaderStats({
        total: LIMIT,
        matching: 0
      });

      if (hasPoap) {
        fetchPoap({
          limit: LIMIT,
          ...requestFilters
        });
        return;
      }

      fetchTokens({
        limit: LIMIT,
        ...requestFilters
      });
    }
  }, [
    fetchPoap,
    fetchTokens,
    filters,
    hasPoap,
    requestFilters,
    shouldFetchTokens
  ]);

  const { hasNextPage, getNextPage } = hasPoap
    ? paginationPoaps
    : paginationTokens;

  const loading = overviewTokens.length === 0 || loadingPoaps || loadingTokens;
  const loaderContext = useLoaderContext();

  useEffect(() => {
    loaderContext.setIsLoading(loading);
  }, [loaderContext, loading]);

  useEffect(() => {
    if (!tokensData || loading) return;

    if (tokensRef.current.length < MIN_LIMIT && hasNextPage) {
      getNextPage();
    } else {
      setShowStatusLoader(false);
      tokensRef.current = [];
    }
  }, [tokensData, loading, hasNextPage, getNextPage]);

  const handleShowMore = useCallback((values: string[], dataType: string) => {
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
      rightValues,
      dataType
    });
    setShowModal(true);
  }, []);

  const handleNext = useCallback(() => {
    if (!loading && hasNextPage && getNextPage) {
      getNextPage();
    }
  }, [getNextPage, hasNextPage, loading]);

  if (loading && (!tokens || tokens.length === 0)) {
    return (
      <>
        <div className="w-full border-solid-light rounded-2xl sm:overflow-hidden pb-5 overflow-y-auto">
          <Loader />
        </div>
        <StatusLoader
          total={loaderStats.total}
          matching={loaderStats.matching}
          tokenName={activeViewToken || ''}
        />
      </>
    );
  }

  return (
    <>
      <div className="w-full border-solid-light rounded-2xl sm:overflow-hidden pb-5 overflow-y-auto mb-5">
        <InfiniteScroll
          next={handleNext}
          dataLength={tokens.length}
          hasMore={hasNextPage}
          loader={null}
        >
          <table className="w-auto text-xs table-fixed sm:w-full">
            <Header />
            <tbody>
              {tokens.map((token, index) => (
                <TableRow key={index}>
                  <Token token={token} onShowMore={handleShowMore} />
                </TableRow>
              ))}
            </tbody>
          </table>
          {!loading && tokens.length === 0 && (
            <div className="flex flex-1 justify-center text-xs font-semibold mt-5">
              No data found!
            </div>
          )}
          {loading && <Loader />}
        </InfiniteScroll>
        <Modal
          heading={`All ${modalValues.dataType} names of ${address.join(', ')}`}
          isOpen={showModal}
          onRequestClose={() => {
            setShowModal(false);
            setModalValues({
              leftValues: [],
              rightValues: [],
              dataType: ''
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
      {(loading || showStatusLoader) && (
        <StatusLoader
          total={loaderStats.total}
          matching={loaderStats.matching}
          tokenName={activeViewToken || ''}
        />
      )}
    </>
  );
}

export const OverviewDetailsTokens = memo(TokensComponent);
