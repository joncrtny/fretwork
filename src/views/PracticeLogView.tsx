import { PRACTICE_MODES } from "../theory.ts";
import { BADGES, badgeTier } from "../gamify.ts";
import { useProgress } from "../state/ProgressContext.tsx";
import { useAuthSync } from "../state/AuthSyncContext.tsx";

/* The practice log: level ring, points, badges, streak scoreboard, the
   last-14-days bar chart and the per-activity breakdown, all derived from
   ProgressContext, with a sign-in footnote from AuthSync. Read-only: time is
   recorded by the shell's practice ticker, not here. */
export function PracticeLogView() {
  const { practiceStats, gStats, gPoints, gLevel } = useProgress();
  const { authUser } = useAuthSync();
  return (
    <div className="pane about">
      {(() => {
        const fmt = (sec: number) => {
          const m = Math.round(sec / 60);
          if (m < 60) return `${m} min`;
          return `${Math.floor(m / 60)}h ${m % 60}m`;
        };
        return (
          <>
            <section className="progress">
              <div className="levelcard">
                <div className="levelring">
                  <svg viewBox="0 0 44 44" width="72" height="72" aria-hidden="true">
                    <circle cx="22" cy="22" r="19" className="lr-track" />
                    <circle cx="22" cy="22" r="19" className="lr-fill" style={{ strokeDasharray: `${(gLevel.pct / 100) * 119.4} 119.4` }} />
                  </svg>
                  <div className="levelnum">
                    <b>{gLevel.level}</b>
                    <span>level</span>
                  </div>
                </div>
                <div className="levelmeta">
                  <div className="levelpts">
                    {gPoints.toLocaleString("en-GB")} <span>points</span>
                  </div>
                  <div className="levelbar">
                    <div className="levelbarfill" style={{ width: `${gLevel.pct}%` }} />
                  </div>
                  <div className="levelnext">
                    {gLevel.toNext.toLocaleString("en-GB")} points to level {gLevel.level + 1}
                  </div>
                </div>
              </div>

              <h2 className="abouthead">Badges</h2>
              <div className="badgegrid">
                {[...BADGES]
                  .sort((a, b) => Number(badgeTier(b, gStats) > 0) - Number(badgeTier(a, gStats) > 0))
                  .map((b) => {
                    const tier = badgeTier(b, gStats);
                    const max = b.tiers.length;
                    const earned = tier > 0;
                    const nextAt = tier < max ? b.tiers[tier] : null;
                    return (
                      <div key={b.id} className={`badge2 ${earned ? "earned" : "locked"}`}>
                        <svg className="badgemedal" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                          <path d="M12 2.5l2.7 5.9 6.3.6-4.8 4.3 1.4 6.2L12 16.9 6.2 19.5l1.4-6.2L2.8 9l6.3-.6z" />
                        </svg>
                        <b className="badgename">{b.name}</b>
                        <span className="badgetier">
                          {!earned
                            ? `Reach ${b.tiers[0]} ${b.unit}`
                            : max > 1
                              ? tier < max
                                ? `Level ${tier} of ${max}`
                                : "Maxed"
                              : "Earned"}
                        </span>
                        {nextAt != null && earned && (
                          <span className="badgenext">
                            Next at {nextAt} {b.unit}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>

            <div className="scoreboard">
              <div className="score">
                <b>{practiceStats.streak}</b>
                <span>day streak</span>
              </div>
              <div className="score">
                <b>{fmt(practiceStats.todayTotal)}</b>
                <span>today</span>
              </div>
              <div className="score">
                <b>{fmt(practiceStats.weekTotal)}</b>
                <span>last 14 days</span>
              </div>
              <div className="score">
                <b>{fmt(practiceStats.allTime)}</b>
                <span>all time</span>
              </div>
            </div>

            <section className="aboutblock">
              <h2 className="abouthead">Last 14 days</h2>
              <div
                className="plogbars"
                role="img"
                aria-label={`Practice minutes over the last fourteen days, ${fmt(practiceStats.weekTotal)} total`}
              >
                {practiceStats.week.map((d, i) => (
                  <div className="plogday" key={d.k} title={`${d.label}: ${fmt(d.total)}`}>
                    <div className="plogbarwrap">
                      <div
                        className="plogbar"
                        style={{ height: `${d.total ? Math.max(4, (d.total / practiceStats.maxDay) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="ploglabel">{i % 2 === 0 ? d.label[0] : ""}</span>
                  </div>
                ))}
              </div>
            </section>

            {practiceStats.modeRows.length > 0 ? (
              <section className="aboutblock">
                <h2 className="abouthead">By activity</h2>
                <div className="plogmodes">
                  {practiceStats.modeRows.map(([m, sec]) => (
                    <div className="plogmode" key={m}>
                      <span className="plogmname">{PRACTICE_MODES[m] || m}</span>
                      <div className="plogtrack">
                        <div className="plogfill" style={{ width: `${(sec / practiceStats.modeRows[0][1]) * 100}%` }} />
                      </div>
                      <span className="plogmtime">{fmt(sec)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="note">
                No practice recorded yet. Time spent in Scales, Chords, drills and the other practice views is logged here automatically, so
                you can see your streak build.
              </p>
            )}
            <p className="note">
              Practice is counted only while the app is open and you are active in a practice view.{" "}
              {authUser ? "Your log syncs to your account." : "Sign in to sync your log across devices."}
            </p>
          </>
        );
      })()}
    </div>
  );
}
