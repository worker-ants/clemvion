# 부작용(Side Effect) 리뷰 — patch-null-validation

## 발견사항

- **[INFO]** DTO 43필드의 `@IsOptional()` → `@IsOptionalNonNull()` 치환은 공개 API(PATCH 21라우트) 의 관측 가능한 응답 계약을 바꾼다 — 이전엔 `null` 을 보내면 500(31건)·엉뚱한 409(노드 `label`)·의도치 않은 값 삭제(200, 트리거 `endpointPath`) 였던 것이 이제 전부 400 `VALIDATION_ERROR` 로 바뀐다.
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:66`(`endpointPath`), `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:22`(`label`), 그 외 파일 4~18 전체의 `@IsOptionalNonNull()` 적용 지점
  - 상세: 이것은 이 PR 의 의도된 수정 자체이고, plan(`plan/in-progress/patch-null-validation.md` §범위)이 프런트엔드가 이 43필드에 `null` 을 보내는 자리가 0건임을 grep 으로 확인했다고 적어 두었다. 다만 이 DTO 들은 공개 REST API 표면이므로, 프런트가 아닌 **외부 API 클라이언트**(문서화되지 않은 통합·스크립트)가 우연히 `null` 을 보내 500 을 받던 경우가 있었다면, 그 호출은 이제 (여전히 실패하지만) 400 으로 바뀐다 — 실패 자체는 계속되므로 파괴적이지 않지만, 상태 코드·에러 바디 형태에 의존하는 외부 클라이언트가 있다면 관측 가능한 차이다.
  - 제안: 추가 조치 불필요 — CHANGELOG.md 에 이미 사용자 대상 공지가 실려 있고(파일 1), 이건 버그 수정의 자연스러운 결과다. 기록 목적의 INFO.

- **[INFO]** 새 공용 데코레이터 `IsOptionalNonNull()` 이 `validationOptions` 를 `ValidateIf` 와 `IsDefined` 양쪽에 그대로 전달한다 — 두 데코레이터가 검증 옵션을 공유(예: 호출자가 향후 `{ each: true }` 를 넘기면 두 데코레이터 모두에 적용됨)한다.
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts:19-27` (`IsOptionalNonNull` 함수 본문)
  - 상세: 현재 리포 전체에서 `IsOptionalNonNull()` 은 인자 없이만 호출되므로(전수 확인, grep 결과 전부 `@IsOptionalNonNull()`) 이 경로는 지금은 실행되지 않는 잠재 동작이다. 스프레드 순서(`{ message: 기본값, ...validationOptions }`)는 호출자가 `message` 를 넘기면 기본 메시지를 정상적으로 덮어쓰는 의도된 설계로 보이며 버그는 아니다.
  - 제안: 조치 불필요 — 실사용 경로가 없어 위험이 현실화되지 않는다. 향후 옵션을 넘기는 호출이 추가되면 `ValidateIf` 쪽에도 같은 옵션이 흘러가는 것이 의도인지만 확인하면 된다.

- **[INFO]** 새 e2e 스펙(`patch-null-rejection.e2e-spec.ts`)이 `beforeAll` 에서 폴더·워크플로·노드·인증 설정·트리거·알림 규칙·테스트 데이터셋·스케줄·모델 설정·어시스턴트 세션 등 다수의 실제 DB 레코드를 생성하고, `afterAll` 은 `db.end()` 만 하고 생성된 레코드를 명시적으로 지우지 않는다.
  - 위치: `codebase/backend/test/patch-null-rejection.e2e-spec.ts:106-108`(`afterAll`), `beforeAll` 블록(파일 20 diff 42~104행)
  - 상세: 이 저장소의 다른 e2e 스펙들(`action-success-status.e2e-spec.ts`, `alerts-threshold-wire-type.e2e-spec.ts` 등)도 동일하게 `afterAll` 에서 `db.end()` 만 수행하고 개별 리소스 삭제는 하지 않는 것을 확인했다 — 기존 컨벤션과 일치하며 이 PR 이 새로 도입한 패턴이 아니다.
  - 제안: 조치 불필요. 기존 컨벤션 준수 확인 차 기록.

## 뮤테이션 검증

가설 확인을 위해 저장소 파일을 수정하지 않았다 — grep/Read 만으로 충분히 검증 가능했다(데코레이터 중복 적용 여부, `IsOptionalNonNull` 네이밍 충돌, 기존 e2e `afterAll` 패턴 대조). `git status --short` 는 리뷰 세션 시작 시점과 동일하게 `review/code/2026/09/27/17_47_49/` 미추적 디렉터리 하나만 보인다 — 리포지토리 파일 변경 없음.

## 요약

핵심 변경(신규 데코레이터 `IsOptionalNonNull` + 14개 모듈 43필드의 `@IsOptional()` → `@IsOptionalNonNull()` 치환)은 순수 함수형 검증 데코레이터 추가로, 전역 상태·환경 변수·네트워크 호출·파일시스템·이벤트/콜백 어디에도 관여하지 않는다. 시그니처가 바뀌는 것은 NestJS DTO 클래스 필드의 검증 데코레이터뿐이고, 각 DTO 필드 자체의 타입(`string | undefined` 등)은 그대로다. 유일한 실질적 "부작용"은 의도된 것 — PATCH 21라우트 43필드가 `null` 입력에 대해 500/409/조용한 삭제 대신 400 `VALIDATION_ERROR` 를 반환하도록 공개 API 응답 계약이 바뀐다는 점이며, 이는 CHANGELOG 에 명시돼 있고 프런트엔드 호출부는 영향 없음이 grep 으로 확인됐다. 새 e2e/유닛 테스트가 만드는 DB 레코드의 미정리(afterAll 에 삭제 없음)는 저장소의 기존 e2e 컨벤션과 동일하다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
