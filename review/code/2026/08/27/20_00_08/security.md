# 보안(Security) Review

## 발견사항

(없음)

- 이번 diff 는 다음을 실측으로 확인했다.
  - `codebase/backend/src/shared/utils/node-output-allowlist.ts` → `codebase/backend/src/nodes/core/node-output-allowlist.ts` 이동은 **import 경로 한 줄**(`'../../nodes/core/node-handler.interface'` → `'./node-handler.interface'`) 외 바이트 단위 동일 (`diff` 로 직접 대조). `NODE_OUTPUT_ALLOWED_KEYS`(fail-closed allowlist, `Object.freeze` 런타임 불변)와 `allowlistNodeOutputKeys` 함수 로직(내부 필드 `_retryState`/`_resumeState` 제외, `__proto__` 오염 방지 포함) 변경 없음.
  - `redactNodeExecutionRow` → `redactNodeExecutionRowForResponse` 리네임(`codebase/backend/src/shared/utils/redact-stored-error.ts`)도 JSDoc 보강 외 함수 본문 변경 없음 (`diff` 로 직접 대조). 세 컬럼(`inputData`/`outputData`/`error`) 마스킹 로직 불변. 호출부 전수 재확인 — 구 이름(`redactNodeExecutionRow`, ForResponse 접미사 없는 형태) 저장소 잔존 **0건**.
  - `codebase/backend/src/modules/external-interaction/interaction.guard.ts` 변경은 JSDoc 한 줄(`EIA-AU-09` 존재하지 않는 요구사항 ID 참조 제거) 뿐이며 `canActivate`/`deny`/토큰 검증 로직은 diff 대상이 아니다 — `Read` 로 전체 파일 확인, `iext`/`itk` 두 토큰 family 검증·401 처리·`req.interaction` 합성 경로 모두 원본 그대로.
  - `interaction.service.ts`/`websocket.service.ts` 의 변경은 `allowlistNodeOutputKeys` import 경로 한 줄뿐 — 참조 대상 함수가 위 이동에서 로직 불변임을 이미 확인했으므로 파급 없음.
  - 신설 `codebase/backend/src/shared/testing/swagger-probe.ts` 는 devDependency `@nestjs/testing`/`@nestjs/swagger` 의 `Test`/`SwaggerModule`을 import 한다. `codebase/backend/tsconfig.build.json` 의 `exclude` 에 `src/shared/testing/**` 를 명시 등재해 `dist` 유출을 차단(선례 `src/repo-guards/**` 와 동일 패턴) — 프로덕션 설치에 없는 devDependency 의 `require()` 가 dist 로 새는 경로를 사전에 막았다.
  - `redact-stored-error.spec.ts` 의 `CRED = 'Bearer sk-live-abc123def456'` 는 마스킹 회귀 테스트용 더미 값이며 리네임 diff 에서 값 자체는 그대로다 — 실제 시크릿 아님, 테스트 목적의 명백한 placeholder.
  - `node-output-allowlist.spec.ts` 이동본(`nodes/core/`)에 `JSON.parse('{"output":{},"__proto__":...}')` 를 이용한 prototype-pollution 방지 캐너리가 포함되어 있으며, spread(`{...obj}`) + `delete` 조합이 실제 프로토타입이 아니라 own property 로서의 `__proto__` 만 다룬다는 점을 테스트가 고정한다 — 이동 전과 동일 보장.
  - 인젝션(SQL/XSS/커맨드/경로탐색), 인증/인가 우회, 암호화 방식, 에러 메시지 정보 노출 관점에서 신규 로직·신규 조건분기는 없다 — 전부 순수 rename/move/doc-sync 이거나(파일 1~4, 6~9, 14~19) 이전 리뷰(`19_36_17`)에서 지적된 JSDoc 오귀속(WARNING, 비보안)을 고친 파일이다(파일 20~30 은 그 리뷰 산출물 자체가 신규 커밋된 것).

## 요약

이번 변경은 EIA/redaction/websocket allowlist 관련 파일들에 대한 순수 위생(hygiene) 리팩터 — 함수·모듈 재배치(리네임 3건 + 파일 이동 1건), 4개 스펙에 중복되던 Swagger `createDocument` 보일러플레이트를 devDependency 격리가 적용된 공유 테스트 헬퍼로 추출, JSDoc 오기 정정, plan/spec 문서 동기화로 구성된다. 보안 경계 역할을 하는 두 핵심 프리미티브 — `nodeOutput` fail-closed allowlist(`allowlistNodeOutputKeys`)와 자격증명 마스킹(`redactNodeExecutionRowForResponse`) — 은 각각 old/new 버전을 직접 `diff` 대조해 로직이 바이트 단위로 보존됨을 확인했고, 인증 가드(`InteractionGuard`)는 문서 주석 한 줄만 바뀌었다. 새로 추가된 테스트 전용 헬퍼(`swagger-probe.ts`)의 devDependency 오염 위험은 `tsconfig.build.json` exclude 로 사전 차단됐다. 새로운 인젝션·인가 우회·시크릿 노출 벡터는 발견되지 않았다.

## 위험도

NONE
