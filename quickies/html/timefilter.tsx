const timeFilter = (
<div className="tw-w-[360px] tw-rounded-lg tw-border tw-border-slate-300 tw-bg-white tw-p-4 tw-text-sm tw-shadow-sm">
  <div className="tw-mb-2 tw-font-medium tw-text-slate-700">Time of day</div>

  <div className="tw-mb-3 tw-flex tw-flex-wrap tw-gap-1">
    <button className="tw-rounded tw-bg-slate-100 tw-px-2 tw-py-1 hover:tw-bg-slate-200">Morning</button>
    <button className="tw-rounded tw-bg-slate-100 tw-px-2 tw-py-1 hover:tw-bg-slate-200">Afternoon</button>
    <button className="tw-rounded tw-bg-slate-100 tw-px-2 tw-py-1 hover:tw-bg-slate-200">Evening</button>
    <button className="tw-rounded tw-bg-slate-100 tw-px-2 tw-py-1 hover:tw-bg-slate-200">Night</button>
    <button className="tw-rounded tw-bg-slate-100 tw-px-2 tw-py-1 hover:tw-bg-slate-200">Business</button>
  </div>

  <div className="tw-grid tw-grid-cols-[auto_1fr] tw-items-center tw-gap-2">
    <label className="tw-text-slate-600">From</label>
    <input
      type="time"
      step="1"
      value="08:00:00"
      className="tw-w-full tw-rounded tw-border tw-border-slate-300 tw-px-2 tw-py-1"
    />

    <label className="tw-text-slate-600">To</label>
    <input
      type="time"
      step="1"
      value="17:30:00"
      className="tw-w-full tw-rounded tw-border tw-border-slate-300 tw-px-2 tw-py-1"
    />
  </div>

  <div className="tw-mt-2 tw-text-xs tw-text-slate-500">
    US Eastern Time, spans midnight if <code>From &gt; To</code>
  </div>

  <div className="tw-mt-3 tw-flex tw-justify-end tw-gap-2">
    <button className="tw-rounded tw-px-2 tw-py-1 tw-text-slate-600 hover:tw-bg-slate-100">
      Clear
    </button>
    <button className="tw-rounded tw-bg-blue-600 tw-px-3 tw-py-1 tw-text-white hover:tw-bg-blue-700">
      Apply
    </button>
  </div>
</div>

)
