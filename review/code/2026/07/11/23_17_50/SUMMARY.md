# Code Review 통합 보고서

## 전체 위험도
**LOW** — 웹채팅 위젯 table 잘림 배너에 `totalCount`(잘리기 전 총 개수) 노출 기능 추가. CRITICAL 없음. 실질 코드(로직/보안/아키텍처)는 전 리뷰어가 NONE~LOW 로 판정했고, 지적된 WARNING 3건은 모두 코드 정합성이 아닌 프로세스 문서(CHANGELOG/followups 트래커) 갱신 누락과 "사용자 노출 문구 전면 교체에 대한 배포 인지" 성격이다. 단, `user_guide_sync` 리뷰어는 `status=success` 로 보고됐으나 출력 파일이 디스크에 존재하지 않아(디스크 write gap) 해당 관점 검토 결과는 이번 통합에서 **누락**돼 있다 — 아래 "데이터 갭" 참고.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DOCUMENTATION | `CHANGELOG.md` 미갱신. 이 저장소는 거의 모든 PR 에 대해 `## Unreleased — <제목> (<spec 경로> §<절>)` 항목을 남기는 확립된 관례가 있고, 특히 L28-34 는 동일 파일(`presentation.ts`/`presentations.tsx`)의 직전 truncation 수정(PR #901)을 다룬 항목으로 스코프·파일이 정확히 겹치는데도 이번 두 커밋(`4e1f665fc`, `f72a08963`) 모두 `CHANGELOG.md` 를 건드리지 않음 | `CHANGELOG.md` | `## Unreleased — 웹채팅 위젯 table 잘림 배너 총 개수 노출 (7-channel-web-chat/1-widget-app §2/R8)` 항목 추가(신규 필드·문구 변경·wire 무변경 서술) |
| 2 | DOCUMENTATION | `plan/in-progress/webchat-widget-presentation-followups.md` 항목 1 이 구현 완료 후에도 stale. 같은 plan 문서(`spec-draft-webchat-truncation-total-count.md` "## 후속 구현")가 스스로 "구현 완료 후 항목 1 을 'table 부분 해소, carousel 잔여'로 재기술" 하겠다고 약속했고 동봉된 `plan_coherence.md` 도 동일하게 WARNING 지적했으나, 구현 커밋(`f72a08963`) 완료 후에도 항목 1 은 예전 문구("표면 확장이라 planner 결정 선행")를 그대로 유지한 채 미갱신 — 후속 작업자가 중복 작업하거나 carousel 잔여를 완료로 오판할 위험 | `plan/in-progress/webchat-widget-presentation-followups.md` L15-19 | 항목 1 텍스트를 "table 부분 해소(PR `f72a08963`/`4e1f665fc`), carousel 잔여(항목 2 와 병합/의존)"로 재기술(체크 표시는 규약상 여전히 금지) |
| 3 | SIDE_EFFECT | `TableView` 잘림 배너 문구가 `totalCount` 유무와 무관하게 전면 교체됨(합쇼체 `"일부 행만 표시됩니다."` → 해요체, 신규 `"총 N개 중 일부만 표시돼요."` 분기 포함). 위젯이 고객사 웹사이트에 iframe 임베드되는 서드파티 컴포넌트라, 저장소가 통제할 수 없는 외부 소비자가 정확한 문자열에 의존한 스크린샷 테스트/스크래이핑을 갖고 있었다면 조용히 깨질 수 있음. 저장소 내부적으로는 spec·plan·테스트가 모두 함께 갱신돼 회귀는 아님(의도된 변경) | `codebase/channel-web-chat/src/widget/components/presentations.tsx` `TableView` 배너 렌더 | 조치 불요(문서화·테스트 완료). 배포노트/CHANGELOG 에 "위젯 table 잘림 배너 문구 변경(고객사 영향 가능)" 한 줄 남겨두면 향후 문의 대응에 도움 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY / TESTING / REQUIREMENT | `totalCount` 값 유효성 검증이 `typeof === "number"` 만 수행 — `NaN`/`Infinity`/음수도 통과해 "총 NaN개…" 같은 문구가 노출될 수 있음(보안 취약점은 아님, 표시 위생 문제). 3개 리뷰어가 공통 지적 | `codebase/channel-web-chat/src/lib/presentation.ts` `toTable()` | 필요시 `Number.isFinite(x) && x >= 0` 로 가드 강화 + `NaN`/음수 회귀 테스트 추가(필수 아님) |
| 2 | ARCHITECTURE | `itemsTotalCount` 는 `TRUNCATION_KEYS` 를 통해 이미 `output` 까지 흡수되지만 `toCarousel()`/`CarouselData` 는 여전히 소비하지 않는 "dead field" 상태 — 후속 carousel 배너 PR 이 동일 패턴을 복붙할 가능성 | `presentation.ts` `TRUNCATION_KEYS`/`toCarousel` | 지금은 YAGNI 로 조치 불요. carousel 배너 구현 착수 시 `{ truncated, totalCount? }` 공유 타입(`TruncationInfo`) 추출 고려 |
| 3 | ARCHITECTURE | 배너 문구 포맷(2가지 분기)이 뷰 컴포넌트(JSX)에 인라인 — spec 에 이미 `locale: 'ko'|'en'` 필드가 존재해 향후 다국어 지원 시 문구 조합 로직이 여러 컴포넌트에 흩어질 위험 | `presentations.tsx:1587-1593` `TableView` | 즉시 조치 불요. 다국어 지원 시점에 `formatTruncationBanner()` 를 `lib/` 로 추출 |
| 4 | MAINTAINABILITY | `totalCount` 는 "truncated=true 일 때만 의미 있음" 이 JSDoc 서술일 뿐 타입으로 강제되지 않음(`truncated:false` + `totalCount` 채움 조합이 이론상 가능). 현재 유일한 소비처(`TableView`)는 `{truncated && ...}` 가드로 안전 | `presentation.ts:39-46`(인터페이스), `:229-233`(`toTable`) | 현재 스코프에서는 과잉설계. 소비처 증가 시 selector(`getTruncationBanner`)로 캡슐화 고려 |
| 5 | TESTING | `truncated=false` + `rowsTotalCount` 존재 조합(즉 `totalCount` 채워져도 배너 미노출)을 명시적으로 검증하는 테스트가 없음 — 현재는 안전하나 회귀 시 조용히 깨질 수 있는 암묵 전제 | `presentation.test.ts`(기존 `rowsTruncated:false` 테스트가 `totalCount` 미단언), `presentations.tsx` `{truncated && ...}` | 기존 테스트에 `expect(tb.totalCount).toBe(1)` 추가 또는 컴포넌트 테스트로 배너 미노출 명시 검증 |
| 6 | TESTING | "부재" 케이스와 "이형(string)" 케이스가 하나의 `it` 블록에 병합돼 있어 실패 시 원인 특정이 어려움(나머지 신규 테스트는 "1 시나리오 = 1 it" 원칙 준수) | `presentation.test.ts` L379-395 | `it.each` 또는 별도 `it` 2개로 분리(선택 사항, 차단 사유 아님) |
| 7 | TESTING | carousel 잘림 배너 부재라는 스코프 경계가 plan 문서로만 문서화되고 자동 회귀 가드(negative test)가 없음 — 향후 무심코 `CarouselData` 에 `totalCount` 추가 시 잡아줄 테스트 부재 | `plan/in-progress/spec-draft-webchat-truncation-total-count.md` "스코프 경계", `toCarousel()`(무변경) | followup PR 착수 시점에 "carousel 은 배너 미노출" negative test 선행 고려 |
| 8 | MAINTAINABILITY | `totalCount` 투영 로직 설명이 인터페이스 JSDoc·구현부 인라인 주석 두 곳에 거의 동일 문장으로 중복(SDD 관례상 결함은 아니나 드리프트 여지) | `presentation.ts:40-45`, `:230-232` | 낮은 우선순위. 필요시 교차 참조 코멘트로 드리프트 위험 완화 |
| 9 | REQUIREMENT | `plan/in-progress/spec-draft-webchat-truncation-total-count.md` "후속 구현" 절의 인용 문구(`~됩니다`)가 같은 문서의 "문체" 결정 및 실제 구현(해요체)과 어긋남 — **코드는 정상**, 문서 자기불일치만 존재 | `plan/in-progress/spec-draft-webchat-truncation-total-count.md` "## 후속 구현" 절 | 인용 문구를 `총 N개 중 일부만 표시돼요.` / `일부 행만 표시돼요.` 로 정정(문서만, 코드 변경 불요) |
| 10 | SCOPE | 배너 문체 정규화(`~됩니다`→`~돼요`)가 `totalCount` 기능 추가와 같은 diff 라인에 번들 — plan 문서에 명시적 근거(같은 배너에서 신규/기존 문구 톤 불일치 방지) 있어 무단 확장 아님 | `presentations.tsx` `TableView`, `presentations.test.tsx` | 조치 불요. 향후 유사 케이스에서 문체 변경을 diff/PR 설명에 별도 명시하는 관행 권장 |
| 11 | DOCUMENTATION | 신규 배너 분기(`typeof totalCount === "number" ? ... : ...`)에 인라인 주석 없음(경미). 동일 fallback 규칙은 `presentation.ts` JSDoc/주석에 이미 명확히 문서화돼 실질 이해에는 지장 없음 | `presentations.tsx` `TableView` | 선택 사항 — 필요시 `// totalCount 는 presentation.ts TableData JSDoc 참고` 1줄 추가 |

**긍정 관찰(조치 불요, 참고용)**: `TableData` 인터페이스 확장은 하위호환 additive change이며 `toTable()`/`TableData` 의 유일한 내부 소비자(`TableView`)에 파급 완결(side_effect); `toTable()` 순수성 유지, 신규 상태/부작용·환경변수·네트워크 호출 없음(side_effect); 기존 확립된 "narrow-and-fallback" 타입가드 어댑터 패턴을 정확히 재사용, `TRUNCATION_KEYS` allowlist chokepoint 존중(architecture); `CarouselData`/wire/백엔드 무변경으로 스코프 정확히 준수(scope); spec 편집이 결정된 두 지점(§2/§R8)으로 정확히 한정(scope); `review/consistency/**` 산출물 diff 포함은 규약상 필수 절차 산출물이라 스코프 이탈 아님(scope); XSS/인젝션/시크릿 노출/인가 우회 등 OWASP 관점 실질 위험 없음, React JSX 텍스트 노드 자동 이스케이프(security).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | typeof 가드로 인젝션/XSS 위험 없음. NaN/Infinity 미필터는 표시 위생 문제(INFO)일 뿐 |
| architecture | NONE | 어댑터 패턴 일관성 유지, 레이어 경계 위반 없음. carousel dead field·문구 로직 인라인은 INFO |
| requirement | LOW | spec(§2/§R8, presentation §4/§5.1/§10.4)과 line-level 일치, spec-drift 없음. NaN 미필터·plan 문서 자기불일치는 INFO |
| scope | LOW | 요청 범위(table totalCount)에 정확히 국한, 무관 리팩토링·기능확장 없음. 문체 번들은 근거 문서화된 정당한 인접 확장 |
| side_effect | LOW | additive/순수 변경, 파급 범위 완결. **WARNING**: 사용자 노출 배너 문구 전면 교체 — 외부(임베드 고객사) 소비자 영향 가능성 |
| maintainability | LOW | 네이밍/타입가드/주석 컨벤션 일관, 복잡도 증가 미미. totalCount-truncated 결합 불변식 미강제는 INFO |
| testing | LOW | 신규 테스트 3+2건 포함 전체 73/73 통과 직접 확인. NaN 미검증·조합 케이스 미검증은 INFO |
| documentation | LOW | 핵심 코드 문서화 수준 높음. **WARNING 2건**: CHANGELOG 미갱신, followups 트래커 stale |
| user_guide_sync | 판정 불가 | `status=success` 보고됐으나 출력 파일(`user_guide_sync.md`)이 디스크에 부재(write gap) — 재시도 필요, 아래 "데이터 갭" 참고 |

## 발견 없는 에이전트

- security, architecture: CRITICAL/WARNING 없음(NONE 등급, INFO만 존재)

## 데이터 갭 — user_guide_sync 출력 누락

`_retry_state.json`/워크플로 매니페스트는 `user_guide_sync` 를 `status=success` 로 보고했으나, 세션 디렉터리(`review/code/2026/07/11/23_17_50/`)에 `user_guide_sync.md` 파일이 실제로 존재하지 않는다(디렉터리 리스팅으로 직접 확인). journal 등 복구 가능한 부가 산출물도 없다. 이는 과거에도 관측된 "sub-agent 는 success 를 보고했지만 디스크 write 가 유실되는" 알려진 갭 패턴과 일치한다 — 이 경우 해당 리뷰어의 실제 발견(WARNING 이 있었을 수도 있음)이 이번 통합 보고서에서 **완전히 누락**돼 있으며, 이를 "발견 없음"으로 간주해서는 안 된다.

## 권장 조치사항

1. **[데이터 갭 우선 해소]** `user_guide_sync` 리뷰어를 재실행해 실제 출력을 확보한 뒤 본 SUMMARY 를 갱신할 것 — 현재 상태로 "clean" 판정을 내리면 거짓 음성 위험이 있음.
2. `CHANGELOG.md` 에 `## Unreleased` 항목 추가(WARNING #1).
3. `plan/in-progress/webchat-widget-presentation-followups.md` 항목 1 텍스트를 실제 구현 상태에 맞게 재기술(WARNING #2).
4. `plan/in-progress/spec-draft-webchat-truncation-total-count.md` "후속 구현" 절의 배너 인용 문구를 실제 구현(해요체)과 맞게 정정(INFO #9, 문서만).
5. (선택) `totalCount` 에 `Number.isFinite`+비음수 가드 추가 및 대응 회귀 테스트(INFO #1) — blocking 아님, 방어적 강화 목적이면 고려.
6. (선택) 배포노트에 위젯 배너 문구 변경 사실 한 줄 기록(WARNING #3) — 조치라기보다 인지 목적.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — router 판단과 무관하게 항상 강제 실행되는 세이프티넷)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff 가 순수 UI 텍스트/필드 투영 변경으로 성능 영향 표면(쿼리·루프·알고리즘 복잡도) 없음으로 판단(상세 사유는 `_routing_decision.json` 미제공) |
  | dependency | 신규/변경 의존성 없음 |
  | database | DB 스키마·쿼리 변경 없음(순수 프론트엔드 위젯 diff) |
  | concurrency | 동시성/레이스 조건 표면(락, 트랜잭션, 비동기 상태 공유) 없음 |
  | api_contract | wire/API 계약 무변경 — 기존에 이미 전송되던 `rowsTotalCount` 필드를 프론트엔드가 추가로 소비할 뿐 |