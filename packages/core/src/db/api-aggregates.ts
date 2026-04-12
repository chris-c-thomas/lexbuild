/** schema_meta key storing precomputed API aggregates populated by CLI ingest. */
export const API_AGGREGATES_META_KEY = "api_aggregates";

/** Aggregate summary for USC/eCFR-style sources. */
export interface TitledSourceAggregate {
  document_count: number;
  title_count: number;
  last_updated: string | null;
}

/** Aggregate summary for one Federal Register month. */
export interface FrMonthAggregate {
  month: number;
  document_count: number;
}

/** Aggregate summary for one Federal Register year. */
export interface FrYearAggregate {
  year: number;
  document_count: number;
  months: FrMonthAggregate[];
}

/** Aggregate summary for the Federal Register corpus. */
export interface FrSourceAggregate {
  document_count: number;
  earliest_publication_date: string | null;
  latest_publication_date: string | null;
  document_types: Record<string, number>;
  years: FrYearAggregate[];
}

/** Precomputed aggregate snapshot used by the Data API. */
export interface ApiAggregates {
  total_documents: number;
  sources: {
    usc: TitledSourceAggregate;
    ecfr: TitledSourceAggregate;
    fr: FrSourceAggregate;
  };
}
