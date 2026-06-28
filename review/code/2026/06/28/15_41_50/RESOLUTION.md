# RESOLUTION — webhook 1MB 게이트 3차 후속 review (15_41_50)

원 SUMMARY: RISK=LOW, CRITICAL=0, WARNING=3 (전체 14 reviewer 완주). 동일 턴의
`--impl-done`(review/consistency/2026/06/28/15_41_51, BLOCK:NO) 발견과 함께 일괄 처리.

## 조치 항목 (ai-review)

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| W1 | Testing | e2e L·M·N 에 `requestId` 단언 누락 | **FIXED**: L·M·N 에 `expect(res.body.error.requestId).toBeDefined()` 추가. |
| W2 | Documentation | `HOOKS_MAX_BODY_BYTES` README·.env.example 미등재 | **FIXED**: `README.md` env 섹션 + `.env.example` Webhook 블록에 등재(기본 1MiB·16MiB 상한·공개 32KB 별개 명시). |
| W3 | Side Effect | `RawBodyRequest<T>` 타입 계약 모호 | **명문화로 해소**: 타입 `rawBody?: Buffer` 는 유효(파서가 채움) — `main.ts` 주석 + `captureRawBody` 인라인 주석(빈 Buffer 보존·`buf.length` 재도입 금지) 명시. 소비처 타입 전면 교체는 불필요한 churn 으로 deferred. |
| I10/I12/I13 | Testing/Doc | ceiling-equal 경계 테스트·captureRawBody 인라인 주석·e2e JSDoc | **FIXED**: 각각 추가. |

## 조치 항목 (--impl-done 15_41_51)

| # | 발견 | 조치 |
|---|---|---|
| WARNING 1 | 완료 plan 이 in-progress 잔류, spec frontmatter stale | **FIXED**: `spec-sync-webhook-gaps.md` → `plan/complete/`(+spec_impact), `12-webhook.md` frontmatter `status: implemented`·`pending_plans` 제거·`code:` 에 hooks-body-parser.ts 추가. |
| INFO 1,2 | `data-flow/10-triggers.md`·`7-channel-web-chat/4-security.md` "무제한 통과" qualifier 부재 | **FIXED**: 본문 크기는 라우트 스코프 1MB body-parser 별도 게이트임을 qualifier 추가(WH-NF-02 링크). |
| INFO 4 | WH-NF-02 옵션 C 결정 근거 미기재 | **FIXED**: `12-webhook.md ## Rationale` 에 옵션 A/B 기각·`bodyParser:false` 순서 의존성·OOM 클램프·표준 413 근거 추가. |
| INFO 9 | `.env.example` HOOKS_MAX_BODY_BYTES | **FIXED(W2 와 동일)**. |
| INFO 10 | 프론트 user-doc(triggers.mdx/en) 1MB "Planned" | **FIXED**: 구현 완료(`413 PAYLOAD_TOO_LARGE`)로 갱신. |

## 보류·후속 항목

- **WARNING 2 (--impl-done)** `agent-memory-extraction` 큐 갭: 본 PR 무관 별 spec 영역(16-system-status-api), 미조치.
- ai-review I1~I9·I11·I14~I16, --impl-done INFO 3·5·6·7·8: 4xx 메시지 sanitize·fail-open 알람·full-entity projection·factory limit 단위·endpoint_path 인덱스 확인·Guard SRP(plan 기술부채 등재)·spec-link 타임아웃 커밋분리·api-convention 413 공존 근거 — 전부 비차단, 현행/후속.
- **별건**: 시간 의존 flaky 테스트 `status-badge.test.tsx humanizeUntil`(integrations, webhook 무관) — spawn_task 로 분리.

## TEST 결과

- lint·unit·build·e2e(225) 통과 (`*-160237`·`*-155911`·`*-160051`). spec-link-integrity 앵커 정합(de-numbered `#비기능-요구사항`) 포함.
