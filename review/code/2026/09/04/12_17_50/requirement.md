# 요구사항(Requirement) 리뷰 — Swagger DTO nullable/presence 계약 정합화 + 경로 정규화 추출

## 검증 방법

핵심 로직 파일(`swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`, `background-run-response.dto.ts`, `create-assistant-session.dto.ts`, `temp-fixture.ts`, `source-scan.ts`)을 `Read`로 전문 확인하고, 관련 spec(`spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md` §1-4)과 line-level 대조했다. DTO 필드가 실제로 wire 상 항상 존재하는지는 `background-runs.service.ts`/`redact-stored-error.ts`를 따라가 확인했다. 저장소를 변형하지 않고 `npx jest`로 관련 스위트 6개(94+37건)를 재실행해 GREEN을 직접 재현했다. `git status --short`로 원상태 확인 완료 — 리뷰 중 저장소에 쓰기 없음.

## 발견사항

- **[WARNING]** "경로 정규화 8곳 전부 통일" 완결 주장이 실제와 다르다 — 9번째 형제 자리(`engine-error-code-anchor-guard.ts`)는 여전히 정규화가 전혀 없고, 이는 1R 리뷰가 "이미 정규화한다"고 잘못 단정했던 바로 그 파일이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:170`, `:196` (`file: path.relative(repoRoot, abs),`) — 이번 diff 대상 파일이 아니라 grep으로 직접 확인한 저장소 현재 상태
  - 상세: `review/code/2026/09/04/11_02_30/RESOLUTION.md`(W2)와 `source-scan.ts`(신설 `toPosixRelative` docstring, `2026-09-04 실측: … 저장소에 8곳`)는 저장소 전체에서 "정규화 누락"이 8곳뿐이었고 그 8곳을 전부 `toPosixRelative`로 통일했다고 주장한다. 그런데 `engine-error-code-anchor-guard.ts:170,196`은 `path.relative(repoRoot, abs)`만 쓰고 `.split(path.sep).join('/')`조차 애초에 없다 — `git log -p`로 확인하니 이 파일은 처음부터(생성 시점부터) 정규화를 한 적이 없다. 흥미롭게도 1R `architecture.md`(`11_02_30`)는 정확히 이 파일의 이 두 줄을 "정규화하는 형제"로 인용하며 W3 대상에서 제외했었다 — 그 인용 자체가 틀렸던 것이고, 아무도 재확인하지 않은 채 "8곳 전부"로 완결 선언됐다. `path.relative(...).split(path.sep).join('/')` 리터럴 패턴으로 grep했을 때만 8곳이 걸리므로, 애초에 정규화 자체가 없는(따라서 그 패턴에 걸리지 않는) 이 자리는 이번 sweep의 탐색 방법으로는 원리적으로 못 찾는다.
  - 영향은 낮다 — `backend-checks.yml` CI는 POSIX(ubuntu)에서만 돌고, `engine-error-code-anchor.spec.ts`는 이 파일의 `.file` 값을 `toEqual([])`(빈 배열)로만 단언해 구분자 형태를 검사하지 않는다. 다만 이번 PR이 표방하는 목표("형제 가드 관례 통일", "저장소 전수 실측") 자체가 완결됐다고 문서에 못 박은 상태에서 같은 결함 클래스의 인스턴스가 하나 더 살아있다는 점에서 완전성 주장이 부정확하다.
  - 제안: `engine-error-code-anchor-guard.ts:170,196`도 `toPosixRelative(repoRoot, abs)`로 맞추거나, 그럴 계획이 없다면 `source-scan.ts`/`RESOLUTION.md`의 "8곳 전부" 문구를 "grep 패턴 기준 8곳"으로 좁혀 다음 사람이 완결로 오독하지 않게 한다. 코드 fix 대상이지 spec drift는 아니다(대상은 `spec/`이 아니라 repo-guard 코드·문서).

- **[NONE — 정합 확인]** `background-run-response.dto.ts` 8필드는 실제로 wire 상 항상 존재한다 — DTO 선언 변경(`@ApiPropertyOptional`→`@ApiProperty({nullable:true})`)이 §5.4와 실제 조립 로직 둘 다와 일치
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43,46,49-56,58-65,67-74,84-88,142-143,145-149`
  - 상세: `background-runs.service.ts:295-296`(`finishedAt`/`durationMs`, 무조건 대입), `:114-127`(`completedAt`/`durationMs`, 무조건 대입), `:268-282`(`nextCursor: string | null`, 무조건 대입), `redactStoredFieldsForResponse`(`redact-stored-error.ts`, `inputData`/`outputData`/`error`를 항상 3키 반환 — `undefined`가 스프레드로 새어들 여지 없음)를 추적해 확인 — 8필드 전부 응답 객체 리터럴에 조건부 스프레드 없이 항상 키가 실린다. `spec/5-system/2-api-convention.md:186-192`(§5.4)의 "상시 존재 필드 → `@ApiProperty({nullable:true})` + `field: T | null`" 규칙과 line-level로 일치한다.
- **[NONE — 정합 확인]** `create-assistant-session.dto.ts` `llmConfigId`의 §5.4 carve-out 근거가 실측으로 성립
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:19`
  - 상세: `spec/5-system/2-api-convention.md`에서 §5.4는 `## 5. 응답 형식`(:115) 하위의 `### 5.4`(:175)로, 응답 바디 전용 절이 맞다 — CHANGELOG·plan의 "이 필드는 §5.4 대상이 아니다" 주장과 문서 구조가 일치한다. `workflow-assistant-session.service.ts:91`(`dto.llmConfigId ?? null`)도 확인해 `undefined`/`null` 둘 다 동일하게 워크스페이스 기본값으로 폴백함을 검증 — 타입 확장(`string?` → `string | null | undefined`)이 기존 런타임 동작과 완전히 일치한다.
- **[NONE — 재현 확인]** `swagger-dto-contract-guard.ts`의 두 축 판정(presence/null) + `@Transform` 예외 + 위치(line/file) 보고 — 저장소를 건드리지 않고 `npx jest`로 재실행해 관련 6스위트(`swagger-dto-contract.spec.ts` 포함) 131건 전부 GREEN을 직접 재현했다. `hasTopLevelNull`의 `ParenthesizedTypeNode` 미언랩, `readBooleanOption`의 non-literal boolean 미인식은 이미 `testing.md`/`api_contract.md`(11_02_30, 11_44_16)가 INFO로 짚었고 저장소 실사례 0건이 함께 확인돼 있어 중복 지적하지 않는다 — 다만 §5.4 "TS가 `| null`인데 nullable 미선언은 어느 쪽에서도 틀렸다"는 요구사항을 가드가 온전히 강제하려면 이 두 갭이 언젠가 실사례를 놓칠 잠재 표면임은 유효하다(이미 등재된 INFO와 동일 결).
- **[NONE]** `temp-fixture.ts`의 async/thenable 조기 실패 처리(`withFiles`) — 의도(리뷰 W4, "조용한 레이스를 시끄러운 에러로") 그대로 구현됐고, `temp-fixture.spec.ts`가 정상/예외/async-오용 세 경로를 모두 겨눈다. TODO/FIXME/HACK/XXX 주석은 diff 전체에서 0건.

## 요약

핵심 변경(Swagger DTO nullable/presence 계약 9곳 수정 + AST 가드 신설)은 spec(`spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md` §1-4)과 line-level로 일치하고, "동작 변경 없음" 주장은 서비스 조립 코드까지 추적해 사실로 확인했다 — 8필드는 항상 wire에 실리고(§5.4 준수 방향 정정), `llmConfigId`는 §5.4 비적용 대상(응답 전용 절)이라는 CHANGELOG/plan의 근거도 문서 구조로 검증됐다. 저장소 실행으로 재현한 결과도 전부 GREEN이다. 유일한 실질 결함은 이번 sweep이 스스로 "완결"이라고 못박은 경로-정규화 클래스에 9번째 미정규화 자리(`engine-error-code-anchor-guard.ts`)가 여전히 남아 있고, 그 자리가 하필 직전 리뷰 라운드에서 "이미 정규화됐다"고 오판된 곳이라는 점이다 — 실질 영향은 낮지만(POSIX-only CI, 값 미단언) 완전성 주장과 실제 사이의 괴리라 WARNING으로 남긴다.

## 위험도

LOW
