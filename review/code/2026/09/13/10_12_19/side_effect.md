# 부작용(Side Effect) 리뷰

## 검토 방법

프롬프트 절단분(파일 16 일부)과 시그니처 변경의 호출부 영향은 저장소 원본을 `Grep`/`Read` 로
직접 대조했다. 저장소 파일은 수정하지 않았다(`git status --short` 확인 불필요 — 뮤테이션 없음).

## 발견사항

- **[INFO] `LlmService.testConnection` 반환 필드 rename (`error` → `message`) — 호출부 영향 없음을 확인**
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` 시그니처, 반환 타입
    `Promise<{ success: boolean; message?: string; dimension?: number }>`)
  - 상세: 이 메서드의 유일한 프로덕션 호출부는
    `codebase/backend/src/modules/llm/llm-model-config.controller.ts:115`
    (`return this.llmService.testConnection(id, workspaceId)` — 순수 위임)이며, 실측
    (`grep -rn "testConnection"`) 결과 다른 내부 소비처는 없다. 프런트엔드 소비처
    `codebase/frontend/src/components/models/model-config-manager.tsx:82` 는 이미 `result.message`
    를 읽고 있어 이번 변경과 정합한다. e2e (`workspace-rbac.e2e-spec.ts`)는 상태 코드만 단언하고
    응답 필드명에 결합돼 있지 않아 영향받지 않는다. 시그니처 변경이지만 blast radius 가
    문서화된 대로 좁게 닫혀 있다.
  - 제안: 없음(확인용 기록).

- **[INFO] OpenAPI 응답에서 `latencyMs` 필드 제거 — 두 DTO, 생산자 0건 실측 확인**
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
    (`ModelTestConnectionResultDto`), `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`)
  - 상세: `IntegrationTestResult` 인터페이스(`integrations.service.ts` 55행대)와
    `LlmService.testConnection` 반환 타입 어느 쪽도 `latencyMs` 를 생산하지 않음을 grep 으로
    재확인했다 — `latencyMs` 전체 출현은 이번 diff 의 주석·CHANGELOG·plan 문서뿐이다. 이는
    공개 OpenAPI 스키마에서 필드를 제거하는 **인터페이스 축소**이지만, 실제로 한 번도 값이
    실린 적이 없어 이를 읽는 클라이언트가 있었다면 원래도 항상 `undefined` 를 받았을 것이다.
    저장소 내 소비처는 없음(프런트엔드 타입에서도 동시에 제거됨, 파일 16).
  - 제안: 없음(확인용 기록). 저장소 밖의 외부 API 소비자가 이 필드를 방어적으로 읽고 있었을
    가능성은 코드로는 배제할 수 없으나, "항상 undefined" 였다는 전제 자체는 실측과 부합한다.

- **[INFO] 신규 컨트롤러 스펙(`llm-model-config.controller.spec.ts`)이 실제 Nest 앱을 부팅 — 자원 정리 확인**
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
    (`describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)'`)
  - 상세: `beforeAll` 에서 `Test.createTestingModule(...).compile()` 후 `moduleRef.createNestApplication()` +
    `app.init()` 으로 실제 HTTP 서버를 띄운다. `afterAll` 에서 `await app.close()` 로 정리하고
    있어 프로세스에 열린 핸들을 남기지 않는다 — 의도한 대로 정리됨을 확인.
  - 제안: 없음(확인용 기록).

- **[INFO] 신규 가드(`guide-error-code-existence.test.ts`)가 `backend/src` + `packages` 전체를 매 테스트 실행마다 재귀 스캔**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (`walkTree(root, ["codebase/backend/src", "codebase/packages"], …)`)
  - 상세: 부작용(전역 상태·파일시스템 쓰기) 관점에서는 read-only 라 문제 없다. 다만 frontend
    테스트 스위트 실행 시점에 `codebase/backend/src` 전수(500+ 파일)를 읽는 교차-패키지 I/O 를
    새로 추가한다 — 기존 `impl-anchor-existence.test.ts` 계열과 같은 패턴이라 새로운 클래스의
    부작용은 아니지만, 참고용으로 기록한다(성능 영향은 이 리뷰의 관점 밖).
  - 제안: 없음(참고).

- **[INFO] 프런트엔드 테스트 픽스처 변경 (`latencyMs` → `dimension`) — 실재 필드로 교체, 회귀 없음**
  - 위치: `codebase/frontend/src/lib/api/__tests__/model-configs.test.ts` (`modelConfigsApi.testConnection` 테스트)
  - 상세: 지어낸 필드(`latencyMs`)를 픽스처로 쓰던 것을 실재 생산 필드(`dimension`)로 교체.
    `codebase/frontend/src/lib/api/model-configs.ts` 의 `unwrap<{...}>` 타입 선언에서도
    `latencyMs` 가 함께 제거돼 타입과 런타임 픽스처가 정합한다.
  - 제안: 없음(확인용 기록).

- **[INFO] 문서·plan·review 파일 변경은 순수 텍스트 — 런타임 부작용 없음**
  - 위치: `CHANGELOG.md`, `codebase/frontend/src/content/docs/**/*.mdx`(6개),
    `plan/in-progress/guide-error-code-truth.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`,
    `review/consistency/2026/09/13/01_15_40/**`(신규 세션 산출물)
  - 상세: 전부 마크다운/MDX/JSON 문서로, 코드 실행 경로·전역 상태·네트워크·환경변수에 영향을
    주지 않는다. `review/consistency/2026/09/13/01_15_40/` 하위 산출물은 `--impl-prep` 세션
    표준 위치(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 정확히 위치해 harness
    관례를 따른다.
  - 제안: 없음(확인용 기록).

## 요약

이번 변경의 핵심 부작용은 **응답 필드 rename(`error`→`message`) + 두 OpenAPI DTO 에서 미사용
필드(`latencyMs`) 제거**라는 공개 인터페이스 변경이다. 두 변경 모두 저장소 전수 grep 으로
소비처를 확인했고, 유일한 내부 호출부(controller)는 순수 위임이라 시그니처 변경의 파급이
그대로 흡수되며, 프런트엔드 소비처는 이미 새 필드명(`message`/`dimension`)을 읽고 있어 이번
diff 와 정합한다. 새로 추가된 컨트롤러 HTTP 왕복 테스트는 실제 Nest 앱을 띄우지만 자원을
올바르게 정리한다. 신규 가드·픽스처 교체·문서 변경은 read-only 이거나 순수 텍스트라 전역
상태·파일시스템 쓰기·네트워크·환경변수 축에서 의도치 않은 부작용을 일으키지 않는다. 저장소
바깥의 미지 API 소비자가 제거된 `latencyMs` 를 읽고 있었을 가능성은 코드로 배제할 수 없으나,
그 필드가 "항상 undefined" 였다는 전제는 이번 리뷰의 grep 실측과 일치한다.

## 위험도

LOW
