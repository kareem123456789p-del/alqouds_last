---
name: qe-performance-testing
description: Test application performance, scalability, and resilience. Use when
  planning load testing, stress testing, or optimizing system performance.
---

## test-types

Test Types

## key-metrics

Key Metrics

## defining-slos

**Bad:** "The system should be fast" **Good:** "p95 response time < 200ms under 1,000 concurrent users"

## realistic-scenarios

**Bad:** Every user hits homepage repeatedly **Good:** Model actual user behavior

## common-bottlenecks

Common Bottlenecks

## database

**Symptoms:** Slow queries under load, connection pool exhaustion **Fixes:** Add indexes, optimize N+1 queries, increase pool size, read replicas

## n1-queries

N+1 Queries

## synchronous-processing

**Problem:** Blocking operations in request path (sending email during checkout) **Fix:** Use message queues, process async, return immediately
