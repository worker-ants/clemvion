# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 spec/plan 문서 변경(코드 diff 없음, 24개 파일 전부 `spec/**`·`plan/**`·`review/**`). Critical 0건, WARNING 2건 모두 문서 내부 표기 정합성 이슈(행 번호 참조 비일관성, plan 파일 개수 라벨 오기)이며 실질 코드 리스크는 없음. 14개 reviewer 전원 실행되었고 forced(router_safety) 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성(maintainability) | 좌표계 표에서 두 문단 이상 떨어진 산문(§1.1 등)이 "행 번호"를 "값"과 구분 없이 접미사 없는 맨숫자로 인용 — 문서가 스스로 경계하는 "값 vs 행 번호" 오독(consistency-check `18_14_45` CRITICAL 사례)과 같은 부류의 모호성이 산문 표기에 남아 있음 | `spec/conventions/egress-masking.md:60,62,44,52`; 동일 패턴이 `plan/in-progress/spec-draft-egress-masking-convention.md:99,102`에도 미러 | `## 1.1` 등 표에서 떨어진 산문에서 행을 지칭할 때 "표의 2행/4행"처럼 명시적으로 접미사를 붙이거나 표를 재인용 |
| 2 | 문서화(documentation) | plan 체크리스트의 `code:` frontmatter 파일 개수 라벨이 "4파일"로 남아 있으나 바로 다음 줄에 실제로 나열된 파일은 6개(consistency WARNING 반영으로 2개 추가된 이력) — 개수 라벨만 갱신 누락 | `plan/in-progress/spec-draft-egress-masking-convention.md:148` (149-154행에 6개 파일 나열, 실제 spec `code:`도 6개로 일치 확인) | "4파일"을 "6파일"로 정정(또는 "4곳 정의처 + 2곳 exhaustive-consumer 추가 = 6파일"로 이력 표기) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 신설 문서가 마스킹 마커 리터럴 값을 의도적으로 배제하고 이름으로만 참조(재마스킹 우회 표면을 넓히지 않는 방어적 방침) | `spec/conventions/egress-masking.md:34` | 조치 불요, 현행 방침 유지 |
| 2 | security | 문서가 "off-by-one = fail-open" 위험을 명시적으로 기록해 향후 회귀 방지에 기여 | `spec/conventions/egress-masking.md` §1.1 | 조치 불요. backend `hasMaskedLeaf`의 연산자 순서가 frontend와 동일한지는 별도 코드 검증 권장(이번 문서 diff 범위 밖) |
| 3 | security | `AuthConfig.config` 필드 마스킹(별도 보안 통제)과의 스코프 분리를 명시적으로 캐비엇 | `spec/conventions/egress-masking.md:30` | 조치 불요 |
| 4 | architecture | 신설 conventions 문서가 `spec/5-system/*.md` 2곳과 양방향 참조를 가져 결합이 누적되는 경향(기존 `node-cancellation.md`↔`execution-context.md` 선례와 일치, CRITICAL 아님) | `spec/conventions/egress-masking.md:26`, `14-external-interaction-api.md:1397`, `6-websocket-protocol.md:198` | 조치 불요(선례 일치). 향후 3번째 유사 문서 작성 시 단방향으로 충분한지 검토 |
| 5 | architecture | 좌표계 표의 4개 선언 중 `MAX_SANITIZE_DEPTH`는 값만 우연히 같은 독립 선언(암묵적 결합) — 문서가 §3에서 "기계가 지키지 않는다"고 스스로 인정 | `spec/conventions/egress-masking.md:38-60, 79-83` | 조치 불요. 자동 가드는 Rationale에서 이미 명시적으로 기각(유한한 문제를 무한한 문제로 바꾸지 않음) |
| 6 | architecture | plan 초안과 최종 spec 문서가 거의 동일한 좌표계 표를 이중 보유(plan-lifecycle 관행상 정상 — 결정 과정 스냅숏 vs 최종 산출물) | `plan/in-progress/spec-draft-egress-masking-convention.md:86-97` vs `spec/conventions/egress-masking.md:38-50` | 조치 불요 |
| 7 | requirement | plan 체크리스트의 `/ai-review` 항목이 미체크 — 본 리뷰 실행 시점 자체를 가리키므로 정상 | `plan/in-progress/spec-draft-egress-masking-convention.md:166` | 리뷰 완료 후 체크 처리 |
| 8 | requirement | 1라운드 consistency-check CRITICAL(좌표계 표 값 오독)이 draft 스냅샷엔 남아있으나 최종 커밋에는 정정 반영됨 | `spec/conventions/egress-masking.md:44-47` | 조치 불요(정상적인 이력 보존) |
| 9 | scope | `review/consistency/2026/08/22/18_14_17/`이 meta.json/`_retry_state.json`만 있고 SUMMARY 등 checker 출력이 없음(1차 라운드 미완주 후 재시도로 이어진 정상 부산물) | `review/consistency/2026/08/22/18_14_17/*.json` | 조치 불요(스코프 문제 아님) |
| 10 | side_effect | 24개 파일 전부 문서/JSON, 코드 부작용 관점(상태변경·전역변수·시그니처·환경변수·네트워크·이벤트) 전부 N/A | 전체 diff | 해당 없음 |
| 11 | maintainability | plan-spec 간 좌표계 표·Rationale 중복 서술은 라이프사이클상 의도된 패턴(W4 트리거 실행 시 spec만 갱신, plan은 완료 후 archive) | `plan/in-progress/spec-draft-egress-masking-convention.md:86-119, 179-195` vs `egress-masking.md:38-62, 102-107` | 조치 불요 |
| 12 | documentation | §1.1의 off-by-one 순서 규율("값 검사가 깊이 검사보다 먼저")이 3행(`hasMaskedMarkerLeaf`)에만 명시되고, 동일 규율을 공유하는 2행 `hasMaskedLeaf`에는 언급 없음(실측상 코드는 양쪽 다 동일) | `spec/conventions/egress-masking.md:42-62` | 두 소비처를 함께 인용하도록 문장 확장(완전성 개선, 강제 아님) |
| 13 | documentation | 신설 문서에 새 소비처 추가 시 어느 상한을 상속해야 하는지 보여주는 절차적 사용 예시가 없음 | `spec/conventions/egress-masking.md` §1 말미 | 선택 사항, 강제하지 않음 |
| 14 | testing | "마스킹은 한 번" 순서 계약의 확인 범위가 `toFanoutEnvelope` 경로로 한정됨을 문서가 스스로 caveat로 명시(테스트 커버리지 갭이지만 이 PR 책임 범위 아님, 형제 plan에 추적 항목 존재) | `spec/conventions/egress-masking.md:75` | 조치 불요(이 PR 범위). `ws-event-types-extract.md` 후속 착수 시 전수 확인 테스트 추가 |
| 15 | testing | 문서가 좌표계 표에 대한 자동 검증 없음을 스스로 인정(Rationale에서 명시적으로 기각된 결정) | `spec/conventions/egress-masking.md:79-83` | 조치 불요 |
| 16 | dependency | 신설 문서 `code:` frontmatter의 6개 내부 코드 경로 전부 실재 확인(dangling reference 없음) | `spec/conventions/egress-masking.md:4-10` | 조치 불요 |
| 17 | dependency | 신설 conventions 문서가 3개 spec 문서(EIA/WS/node-output)의 참조 허브가 되며, 기존 "상한을 합치지 않는다"는 코드 결정과 정합적인 단방향 트리 구조 유지 | `spec/5-system/14-external-interaction-api.md`, `6-websocket-protocol.md`, `spec/conventions/node-output.md` | 조치 불요 |
| 18 | user_guide_sync | `spec-major-change` glob trigger는 매칭되지만 target이 유저 가이드 MDX가 아니라 spec frontmatter 자기 정합성(consistency-checker 영역)이며, 이미 2라운드 BLOCK:NO로 수렴 확인됨 | `.claude/config/doc-sync-matrix.json` id `spec-major-change` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 코드 변경 없음. 문서가 마커 리터럴 비공개·fail-open 위험 명시 등 오히려 방어적 |
| performance | NONE | 실행 코드 없음, 점검 대상 없음 |
| architecture | NONE | 코드 구조 변경 없음. SoT 분리 표는 기존 선례와 정합, 순환 권위 없음 |
| requirement | NONE | 좌표계 표를 6개 소스 파일과 줄 단위 대조해 전부 일치 확인, 가드 테스트 전부 통과 |
| scope | NONE | 24개 파일 전부 `spec/**`·`plan/**`·`review/**` 내, over-engineering 없음 |
| side_effect | NONE | 코드 부작용 관점 전부 N/A |
| maintainability | LOW | 행 번호 표기 비일관성 WARNING 1건 |
| testing | LOW | 신규 코드 테스트 없음(정상). 기존 6개 소스 테스트가 문서 주장을 뒷받침, 갭은 문서가 스스로 caveat |
| documentation | LOW | plan 체크리스트 파일 개수 라벨 오기 WARNING 1건, spec 본문은 실측 검증 전부 정확 |
| dependency | NONE | 의존성 표면 변경 없음, 내부 코드 참조 전부 실재 확인 |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 |
| api_contract | NONE | API 표면 변경 없음 |
| user_guide_sync | NONE | 매칭 target이 유저 가이드가 아닌 spec 정합성(consistency-checker 영역), 이미 BLOCK:NO 수렴 |

## 발견 없는 에이전트

security, performance, architecture, requirement, scope, side_effect, dependency, database, concurrency, api_contract, user_guide_sync (CRITICAL/WARNING 기준. 일부는 INFO 존재)

## 권장 조치사항
1. `plan/in-progress/spec-draft-egress-masking-convention.md:148`의 "4파일"을 "6파일"로 정정 (documentation WARNING #2).
2. `spec/conventions/egress-masking.md` §1.1 등 표에서 떨어진 산문의 행 번호 인용에 "표 N행" 형태로 명시적 접미사 부여 (maintainability WARNING #1).
3. (선택) §1.1 순서 규율 문장에 `hasMaskedLeaf`도 함께 인용, 새 소비처 추가 절차 예시 추가 — 강제 아님.
4. `ws-event-types-extract.md`의 `TerminalErrorPayload` 전 경로 `sanitizeErrorMessage` 경유 확인 항목은 별도 후속 PR에서 처리(이번 PR 책임 범위 아님).

## 라우터 결정

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원)
- **제외**: 없음 (0명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |

라우팅 사유: `fallback-distrusted-decision` — 라우터의 선별 결정이 신뢰되지 않아 fallback으로 전체 14개 reviewer 가 실행됨. forced(router_safety) 화이트리스트 7명 전원 결과가 확보되어 강제 목록 미이행에 따른 누락 위험 없음.
