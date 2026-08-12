/* The tour's spotlight and card. Pure presentation over the useTour state:
   it positions the card near the highlighted target (or centres it when the
   target is missing or too tall), traps clicks off the highlight to dismiss,
   and offers Back/Next/Skip/Done. Renders nothing when no tour is running. */
export function TourOverlay({ tour, setTour, tourRect, tourCardRef, tourSteps, endTour }) {
  if (tour < 0) return null;
  const step = tourSteps[tour];
  const pad = 6;
  const spot = tourRect
    ? { left: tourRect.x - pad, top: tourRect.y - pad, width: tourRect.w + pad * 2, height: tourRect.h + pad * 2 }
    : null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const CARD_H = 214;
  const CARD_W = 320;
  let cardStyle;
  if (!spot || spot.height > vh * 0.7) {
    /* full-height or missing target: centre the card, drawer stays highlighted behind */
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  } else {
    const placeBelow = vh - (spot.top + spot.height) > CARD_H + 24;
    const top = placeBelow ? spot.top + spot.height + 12 : Math.max(12, spot.top - CARD_H - 12);
    const left = Math.max(12, Math.min(spot.left, vw - CARD_W - 12));
    cardStyle = { top, left };
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Guided tour">
      <div
        className="tourscrim"
        onClick={(e) => {
          /* clicking the highlighted control should not dismiss the tour */
          if (
            spot &&
            e.clientX >= spot.left &&
            e.clientX <= spot.left + spot.width &&
            e.clientY >= spot.top &&
            e.clientY <= spot.top + spot.height
          )
            return;
          endTour();
        }}
      />
      {spot && <div className="tourspot" style={spot} />}
      <div className="tourcard" style={cardStyle} ref={tourCardRef} tabIndex={-1}>
        <p className="tourstep">
          Step {tour + 1} of {tourSteps.length}
        </p>
        <h3 className="tourtitle">{step.title}</h3>
        <p className="tourbody">{step.body}</p>
        <div className="tourbtns">
          <button className="btn ghost" onClick={endTour}>
            Skip
          </button>
          <span className="actspacer" />
          {tour > 0 && (
            <button className="btn ghost" onClick={() => setTour((t) => t - 1)}>
              Back
            </button>
          )}
          {tour < tourSteps.length - 1 ? (
            <button className="btn primary" onClick={() => setTour((t) => t + 1)}>
              Next
            </button>
          ) : (
            <button className="btn primary" onClick={endTour}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
