import { Caratula } from '../components/Caratula';
import { DiscrepanciesPanel } from '../components/DiscrepanciesPanel';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { RouteSlip } from '../components/RouteSlip';
import { TimelinePanel } from '../components/TimelinePanel';
import { useShipment } from '../useShipment';
import { OpenFile } from './OpenFile';

/** The central screen is the file: cover, routing slip, decisions, documents, logistics. */
export function FileView() {
  const shipment = useShipment();
  if (!shipment) return <OpenFile />;
  return (
    <div className="grid gap-5">
      <Caratula shipment={shipment} />
      <RouteSlip shipment={shipment} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <DiscrepanciesPanel shipment={shipment} />
        <TimelinePanel shipment={shipment} />
      </div>
      <DocumentsPanel shipment={shipment} />
    </div>
  );
}
