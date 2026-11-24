import { useT } from '../../i18n';
import { href } from '../useHashRoute';

export function NeedsFile() {
  const t = useT();
  return (
    <div className="sheet sheet-body grid justify-items-start gap-3">
      <p className="note">{t('open.lede')}</p>
      <a className="btn" href={href('expediente')}>{t('open.title')}</a>
    </div>
  );
}
