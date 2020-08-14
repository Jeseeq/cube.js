import React, { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './styles.module.css';

const totalLimit = 12;
const localLimit = Math.floor(totalLimit / 4); // 4 types of items

const periodOffset = 2;
const granularityOffset = 1;

const periods = [
  'Last Week',
  'Last Month',
  'Last Quarter',
  'Last Year',
  'Last 5 Years',
];

const granularities = [
  'Hour',
  'Day',
  'Week',
  'Month',
  'Year'
];

export default function UniversalFilter(props) {
  const { onClose } = props;

  const [filter, setFilter] = useState('');

  return (
    <div className={styles.wrapper}>
      <div className={styles.root}>
        <div className={styles.input}>
          <div className={styles.greeting}>Jump to:</div>
          <div className={styles.control}>
            <input
              type='text'
              value={filter}
              onChange={event => setFilter(event.target.value)}
              autoFocus
              placeholder='Channels, members, date range, granularity'
            />
          </div>
          <div className={styles.close} onClick={onClose} />
        </div>
        <ul className={styles.list}>
          {renderPeriods(props, filter.toLowerCase())}
          {renderGranularities(props, filter.toLowerCase())}
          {renderMembers(props, filter.toLowerCase())}
          {renderChannels(props, filter.toLowerCase())}
        </ul>
      </div>
    </div>
  );
}

function findByWordStart(haystack, needle) {
  return haystack
    .toLowerCase()
    .split(' ')
    .some(item => item.startsWith(needle))
}

function renderPeriods(props, filter) {
  const { granularity, member, channel, onSelect } = props;

  const items = filter
    ? periods.filter(item => findByWordStart(item, filter)).slice(0, localLimit)
    : periods.slice(periodOffset, periodOffset + localLimit);

  return items.map(row => (
    <li
      key={row}
      className={styles.item}
      onClick={() => onSelect(row.toLowerCase(), granularity, channel, member)}
    >
      <span className={styles.sign}>Date</span>
      <span className={styles.main}>{row}</span>
    </li>
  ))
}

function renderGranularities(props, filter) {
  const { period, member, channel, onSelect } = props;

  const items = filter
    ? granularities.filter(item => findByWordStart(item, filter)).slice(0, localLimit)
    : granularities.slice(granularityOffset, granularityOffset + localLimit);

  return items.map(row => (
    <li
      key={row}
      className={styles.item}
      onClick={() => onSelect(period, row.toLowerCase(), channel, member)}
    >
      <span className={styles.sign}>By</span>
      <span className={styles.main}>{row}</span>
    </li>
  ))
}

function renderMembers(props, filter) {
  const { period, granularity, members, channel, onSelect } = props;

  const items = filter
    ? members.filter(item => findByWordStart(item.name, filter)).slice(0, localLimit)
    : members.slice(0, localLimit);

  return items.map(row => (
    <li
      key={row.name}
      className={styles.item}
      onClick={() => onSelect(period, granularity, channel, row.name)}
    >
      <span className={styles.sign}>@</span>
      <span className={styles.main}>{row.name}</span>
    </li>
  ))
}

function renderChannels(props, filter) {
  const { period, granularity, channels, member, onSelect } = props;

  const items = filter
    ? channels.filter(item => findByWordStart(item.name, filter)).slice(0, localLimit)
    : channels.slice(0, localLimit);

  return items.map(row => (
    <li
      key={row.name}
      className={styles.item}
      onClick={() => onSelect(period, granularity, row.name, member)}
    >
      <span className={styles.sign}>#</span>
      <span className={styles.main}>{row.name}</span>
    </li>
  ))
}

UniversalFilter.propTypes = {
  period: PropTypes.string.isRequired,
  granularity: PropTypes.string.isRequired,
  channels: PropTypes.arrayOf(PropTypes.object).isRequired,
  members: PropTypes.arrayOf(PropTypes.object).isRequired,
  channel: PropTypes.string,
  member: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};