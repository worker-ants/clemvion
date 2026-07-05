# Rationale 연속성 검토 결과

## 발견사항

- **[WARNING]** Folder 재부모화(cycle/깊이) 검증 신설이 spec 본문에만 반영되고 `## Rationale` 절에 새 항목이 추가되지 않음
  - target 위치: `spec/1-data-model.md §2.5 Folder` (제약 조건 3줄 추가: 워크스페이스 일치·비순환·깊이 5 "생성·부모 변경 모두에 적용"), `spec/2-navigation/1-workflow-list.md §3.1` PATCH `/api/folders/:id` 행 (재부모화 계층 무결성 검증 신설)
  - 과거 결정 출처: 두 문서 모두 기존에 유사 신규 결정 시 `## Rationale` 절에 근거를 명시해 온 관례가 있음. 예컨대 같은 `1-workflow-list.md §3.2` item 6 의 `settings` VALIDATION_ERROR 결정은 본문에서 `([Rationale §2](#rationale), 2026-07-04)` 로 Rationale 절을 직접 인용한다. `1-data-model.md` 도 `install_token`·`execution_path` 등 스키마 제약 변경마다 `## Rationale` 에 배경·대안 비교를 기록해 온 문서다.
  - 상세: 이번 변경은 `update()`(PATCH)가 종전 무검증이었던 것을 `create()`와 동일 수준으로 맞추는 자연스러운 보강이며 내용 자체는 타당하다. 그러나 (a) 어떤 에러 코드를 재사용할지(`VALIDATION_ERROR` vs 전용 cycle 코드 신설), (b) 왜 서브트리 전체를 BFS 로 재계산하는 방식을 택했는지(성능 vs 정확성 트레이드오프), (c) 왜 `parentId: null`(루트 이동)만 검증을 건너뛰는지 등 결정 근거가 코드 주석(`folders.service.ts` 상단 JSDoc)에는 있으나 spec 의 `## Rationale` 절에는 없다. 코드 주석은 향후 spec 만 보는 독자(기획자·타 서비스 연동자)에게 전달되지 않아 "왜 이렇게 설계했는가"가 spec 단일 진실에서 누락된다.
  - 제안: `spec/2-navigation/1-workflow-list.md` 의 `## Rationale` 절에 짧은 항목(예: "3. 폴더 재부모화 cycle/깊이 검증 — VALIDATION_ERROR 재사용")을 추가해, 코드 주석에 있는 근거(신규 cycle 코드를 도입하지 않은 이유, BFS 서브트리 재계산 방식, 루트 이동만 예외인 이유)를 옮겨 적을 것을 권장.

- **[INFO]** 신설된 폴더 순환(cycle) 에러가 코드베이스의 기존 "cycle 전용 에러 코드" 관례와 벗어나 있음 (원칙 위반은 아니나 정합성 갭)
  - target 위치: `codebase/backend/src/modules/folders/folders.service.ts` `validateParentChange()` — 순환 감지 시 `VALIDATION_ERROR` 400 사용
  - 과거 결정 출처: `spec/data-flow/11-workflow.md §1.2`, `spec/3-workflow-editor/0-canvas.md` (컨테이너 순환 → `CONTAINER_CYCLE`), `spec/5-system/3-error-handling.md §1.4`/`spec/3-workflow-editor/4-ai-assistant.md` (그래프 순환 → `CYCLE_DETECTED`) — 코드베이스는 "순환은 의미 기반 전용 코드를 쓴다"는 일관된 선례를 두 군데(노드 컨테이너·워크플로우 그래프)에서 확립했다. `spec/conventions/error-codes.md §1` 의 "에러 코드 이름은 조건의 의미를 기술한다" 원칙과도 결이 맞는 선례다.
  - 상세: 이번 Folder 순환은 위 두 선례와 달리 전용 코드 없이 `VALIDATION_ERROR` 범용 코드로 뭉뚱그렸다. `error-codes.md §1` 은 `VALIDATION_ERROR` 를 "시스템 전역 공용 코드"로 명시적 예외 범주로 인정하므로 이는 **원칙 위반은 아니다** — 하지만 "폴더 계층에서도 cycle 은 전용 코드로 노출한다"는 기존 2건의 선례와는 결이 다른 선택이라, 클라이언트가 향후 폴더 API 에서도 컨테이너/그래프처럼 `*_CYCLE`/`CYCLE_DETECTED` 류 코드를 기대할 수 있어 혼란 여지가 있다.
  - 제안: 코드 주석에 이미 있는 근거("신규 cycle 코드를 도입하지 않아 `CONTAINER_CYCLE`·`CYCLE_DETECTED` 와의 혼동을 피한다")를 spec Rationale 에도 명문화해, 향후 리뷰어가 "왜 폴더만 예외인가"를 다시 묻지 않도록 한다. 필요하면 `error-codes.md §3` historical-artifact 성격은 아니지만, 참고용으로 "폴더 계층 cycle 은 의도적으로 VALIDATION_ERROR 를 재사용한다"는 한 줄을 `1-workflow-list.md` Rationale 에 남기는 것으로 충분.

- **[INFO]** `getDepth()` 무한루프 방어(visited set + 상한)가 기존 시스템 invariant("정상 데이터는 트리, cycle 없음")를 사후 방어하는 형태로 추가됨 — 근거 문서화 확인
  - target 위치: `codebase/backend/src/modules/folders/folders.service.ts` `getDepth()` — `visited` Set + `depth > MAX_NESTING_DEPTH + 1` 상한 추가
  - 과거 결정 출처: `spec/1-data-model.md §2.5` (기존 "중첩 깊이 제한: 최대 5단계"는 생성 시점 강제만 명시, 데이터가 항상 acyclic 이라는 암묵 가정 위에 `getDepth()` 가 서 있었음)
  - 상세: 이번 변경은 "이미 손상된 데이터(예: 과거 버그·수동 DB 조작으로 생긴 cycle)에서도 서버가 무한루프에 빠지지 않는다"는 방어적 코딩이며, 이는 기존 invariant(계층은 항상 tree)를 우회하는 설계가 아니라 그 invariant 가 깨졌을 때의 안전망이다. Rationale 연속성 관점에서 문제는 없으나, 코드 주석에 "cycle 은 getDepth 무한루프 유발"이라 명시된 것으로 보아 이는 실제로 과거 갭(재부모화 무검증으로 인한 cycle 유입 가능성, V-04)을 인지하고 고친 것이므로 위 첫 발견사항과 함께 하나의 Rationale 항목으로 묶어 기록하는 것이 정합적이다.
  - 제안: 별도 조치 불요 — 첫 발견사항의 Rationale 보강에 포함해서 함께 서술 권장.

## 요약

이번 변경(`folder-depth-cycle-guard`)은 `PATCH /api/folders/:id` 의 `parentId` 변경 경로에 `create()` 와 동일한 계층 무결성 검증(워크스페이스 일치·비순환·깊이 5)을 추가하는 보강으로, 과거 spec 이 명시적으로 기각한 대안을 재도입하거나 합의된 설계 원칙을 정면으로 위반하는 지점은 발견되지 않았다. 다만 (1) 새로 도입한 invariant·에러 코드 재사용 결정(`VALIDATION_ERROR`)의 근거가 코드 주석에만 존재하고 spec 의 `## Rationale` 절에는 반영되지 않아, 같은 문서가 유사 결정마다 지켜온 "본문 서술 + Rationale 근거 기록" 관례에서 벗어나 있고, (2) 코드베이스에 이미 확립된 "cycle 은 전용 에러 코드로 노출한다"(`CONTAINER_CYCLE`/`CYCLE_DETECTED`) 선례와 결이 다른 선택(`VALIDATION_ERROR` 재사용)을 했다는 점에서 문서적 정합성 보완의 여지가 있다. 두 사항 모두 원칙 위반이라기보다 "결정은 타당하나 Rationale 미기록"에 해당해 WARNING/INFO 수준이다.

## 위험도

LOW
