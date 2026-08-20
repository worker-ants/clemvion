# API Contract Review — eia-inputdata-marker-guard

## 발견사항

- **[WARNING]** `GET /api/executions/:id` 등 `Execution.inputData` 응답 필드의 **콘텐츠 시맨틱이 breaking 하게 바뀐다** — raw 값 → egress 마스킹된 값. 이 프로젝트는 URL 버전을 두지 않고 "단일 버전 운영"(`spec/5-system/2-api-convention.md` §1) 이라 프런트와 백엔드가 같은 배포에 동기화되는 걸 전제하는데, `inputData` 는 프런트 가드(마커 프리필 차단)가 이미 이 PR 에 동봉돼 정합이 맞는다. 다만 **이 필드를 읽는 소비자가 프런트 하나뿐이라는 보장은 코드로 서 있지 않다** — 워크스페이스 JWT 로 이 엔드포인트를 직접 호출하는 사내 자동화·백오피스 스크립트·리포팅 도구가 있다면, 배포 시점부터 `inputData` 가 조용히 `'***'`/`[REDACTED]` 로 바뀌어 그 값을 그대로 소비하던 로직이 잘못된 데이터를 받는다(반대로 이번 변경 자체가 막으려는 "리터럴 마스크 문자열이 실 데이터로 오염되는" 패턴과 같은 클래스의 위험이 API 소비자 쪽으로 이동한 셈). OpenAPI 타입(`Record<string, unknown> | null`)은 그대로라 스키마 상으로는 드러나지 않고 설명 문구(`@ApiPropertyOptional description`)만 갱신돼 있다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (`ExecutionDto.inputData` JSDoc, `Read` 로 확인한 실제 파일 49~56행), `codebase/backend/src/modules/executions/executions.service.ts` (`toResponseExecution`/목록 조립부, `git diff` 로 확인한 실제 변경 — 이 diff 는 prompt 에 생략돼 있어 게이트 번호 인용 불가)
  - 상세: 응답 타입 시그니처는 안 바뀌었으나 **값의 진실성(원문 vs 마스킹)** 이 바뀌는 것은 API 소비자 관점에서 실질적 breaking change 다. CHANGELOG·spec(EIA §R17)·DTO description 3곳에 잘 문서화돼 있어 "문서화되지 않은 변경"은 아니지만, 이 API 에는 릴리스 노트를 구독하거나 Accept-헤더 버전 협상을 할 메커니즘이 없다(§1 "단일 버전 운영").
  - 제안: 이 엔드포인트가 프런트 전용(다른 소비자 없음)이라는 전제가 맞다면 그 사실을 spec 에 한 줄로 명시해 두면 향후 리뷰가 재확인할 필요가 없다. 만약 사내 자동화가 이 API 를 직접 호출하는 사례가 있다면 EIA §R17 "잔여 갭" 섹션처럼 이번 변경도 캐비엇으로 남기는 것을 권장.

- **[INFO]** `POST /executions/:id/re-run` 의 `inputOverride` 는 여전히 서버 측에서 마스킹 마커(`'***'`/`[REDACTED]`/`[REDACTED_DEPTH]`) 값을 거부하지 않는다 — 방어는 전적으로 클라이언트(`rerun-modal.tsx` 의 `blockedByMaskedInput`)에만 있다. `ReRunRequestDto.inputOverride` 는 `@IsObject()` 외 별도 검증이 없다(`codebase/backend/src/modules/executions/dto/re-run.dto.ts`). 이 자체는 이번 diff 가 만든 결함이 아니고 `review/code/2026/08/20/14_44_08/RESOLUTION.md` 트래커 6번에 "이번 PR 이 만든 결함이 아니다 — security 도 INFO 로 판정, §R17 이 가드 범위를 UI 정상 흐름으로 명시" 로 이미 처분·기록돼 있다. API 계약 관점에서도 같은 결론 — 요청 검증의 최종 방어선(server-side reject)이 없다는 사실은 유효하지만 별도 트래커 항목으로 이미 등재돼 재차단할 사안이 아니다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`ReRunRequestDto.inputOverride`, 실제 파일 18~25행), `codebase/frontend/src/components/executions/rerun-modal.tsx` (`blockedByMaskedInput`)
  - 상세: 위와 같음.
  - 제안: 추가 조치 불요(기존 트래커 항목으로 처리 중).

- **[INFO]** 마스킹 정책이 `Execution.inputData` / `nodeExecutions[].inputData` / `background-runs` 노드 `inputData` 세 표면에 걸쳐 **일관되게** 적용되도록 배선돼 있음을 확인 (`executions.service.ts` `toResponseExecution`·`buildExecutionListDto`·`toResponseNodeExecution` 세 지점, `background-runs.service.ts`). `ResponseExecution` 타입도 `Omit<Execution,'error'|'inputData'|'outputData'|...>` 로 넓혀 마스킹 누락 시 컴파일 타임에 걸리도록 강제한다 — 응답 스키마 일관성 축에서 양호.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`ResponseExecution` 타입), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:303-307`
  - 상세: 이전에는 `Execution.inputData` 만 예외였고 `NodeExecution.inputData` 는 이미 마스킹돼 있어 레벨 간 정책이 갈렸다(§R17 이전 상태). 이번 변경으로 두 레벨이 같은 규칙이 되어 flip-flop·비대칭 리스크가 사라졌다.
  - 제안: 없음 (양호).

- **[INFO]** 인증/인가 표면 변경 없음 — `GET /api/executions/:id` 는 이전과 동일하게 `@Roles` 게이트 없이 워크스페이스 멤버 전원(viewer 포함)에게 열려 있고, 이번 변경은 그 노출 범위를 넓히는 게 아니라 오히려 노출되는 값의 민감도를 낮추는 방향(원문 → 마스킹)이라 인가 관점에서는 개선에 가깝다.
  - 위치: 해당 없음(변경 없음 확인용)
  - 상세: 없음.
  - 제안: 없음.

- **[INFO]** URL/경로·페이지네이션·에러 응답 포맷은 이번 diff 에서 변경되지 않았다(신규 엔드포인트·경로 변경·에러 envelope 변경 없음).

## 요약

이번 PR 의 핵심은 `Execution.inputData` 의 egress 마스킹 카브아웃을 닫아 backend 응답 값의 시맨틱을 "원문"에서 "자격증명 마스킹된 값"으로 바꾸고, 그 반작용(마스킹된 값이 재제출돼 데이터가 오염되는 문제)을 프런트 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리)의 마커 가드로 동시에 막는 구성이다. 응답 타입 시그니처(OpenAPI 스키마)는 그대로이고 값의 진실성만 바뀌는 콘텐츠 레벨 변경이라 정적 스키마 검증으로는 드러나지 않으며, 이 프로젝트가 URL 버전 관리를 쓰지 않고 프런트·백엔드 동시 배포를 전제하므로 실질적 파급은 제한적이지만, 동일 엔드포인트를 프런트 이외 경로로 직접 호출하는 소비자가 있다면 조용한 breaking change 가 된다. `inputOverride` 서버측 마커 거부 부재는 실질 검증 갭이지만 이번 PR 의 신규 결함이 아니고 이미 별도 트래커 항목(RESOLUTION.md #6)으로 의도적으로 defer 돼 있다. 세 응답 표면(Execution/NodeExecution/BackgroundRun) 간 마스킹 정책 일관성은 타입 레벨로 강제되어 양호하다.

## 위험도

LOW
