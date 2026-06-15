import styles from './PageLoader.module.css';

const PageLoader = () => (
  <div className={styles.wrap}>
    <div className={styles.spinner} />
  </div>
);

export default PageLoader;
