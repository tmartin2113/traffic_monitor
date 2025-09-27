import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { TrafficEvent } from '@types/api.types';

interface VirtualEventListProps {
  events: TrafficEvent[];
  onLoadMore: () => Promise<void>;
  hasNextPage: boolean;
}

export const VirtualEventList: React.FC<VirtualEventListProps> = ({
  events,
  onLoadMore,
  hasNextPage
}) => {
  const itemCount = hasNextPage ? events.length + 1 : events.length;
  const loadMoreItems = hasNextPage ? onLoadMore : () => Promise.resolve();
  const isItemLoaded = (index: number) => !hasNextPage || index < events.length;

  const Row = ({ index, style }: any) => {
    if (!isItemLoaded(index)) {
      return <div style={style}>Loading...</div>;
    }

    const event = events[index];
    return (
      <div style={style} className="event-row">
        <EventCard event={event} />
      </div>
    );
  };

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={itemCount}
      loadMoreItems={loadMoreItems}
    >
      {({ onItemsRendered, ref }) => (
        <List
          height={600}
          itemCount={itemCount}
          itemSize={120}
          onItemsRendered={onItemsRendered}
          ref={ref}
          width="100%"
        >
          {Row}
        </List>
      )}
    </InfiniteLoader>
  );
};
