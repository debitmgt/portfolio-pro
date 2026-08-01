// app/api/cron/refresh-monthly-rankings/route.ts
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendFailureAlert } from '@/lib/email/alerts'
import type { NextRequest } from 'next/server'

export const maxDuration = 480
export const dynamic = 'force-dynamic'

const METHODOLOGY_VERSION = 'v2-tiered'
const TOP_N = 25

const WEIGHTED_METHODOLOGY_VERSION = 'v1-recency-weighted'
const WEIGHTED_TOP_N = 50
const WEIGHT_13W = 0.5
const WEIGHT_26W = 0.3
const WEIGHT_52W = 0.2

const LARGE_CAP_MIN_M = 10_000
const MID_CAP_MIN_M = 2_000

const BATCH_SIZE = 25
const BATCH_PAUSE_MS = 65_000

// Sanity check: if we write fewer than this many rows, something went wrong
const MIN_ROWS_SANITY_FLOOR = 60

const CURATED_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ORCL', 'CRM',
  'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'PFE', 'TMO', 'ABT',
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA', 'BLK',
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'HD', 'NFLX',
  'CAT', 'HON', 'UPS', 'RTX', 'BA', 'DE',
  'XOM', 'CVX', 'COP', 'SLB', 'EOG',
  'T', 'VZ', 'TMUS',

  'DOCU', 'TWLO', 'HUBS', 'BOX', 'PCOR', 'ESTC', 'FROG', 'PATH', 'BILL',
  'PAYC', 'MDB', 'DDOG', 'GTLB', 'CFLT', 'FRSH', 'APPF', 'BLKB', 'PCTY',
  'GWRE', 'SPT', 'DBX', 'SMAR', 'NCNO', 'DV',