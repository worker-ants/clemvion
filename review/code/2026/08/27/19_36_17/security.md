# 보안(Security) 리뷰 결과

## 개요

본 changeset 은 기능 변경이 아니라 **위생(hygiene) 리팩터링**이다:

- `redactNodeExecutionRow` → `redactNodeExecutionRowForResponse` 함수명 rename (호출부 동반)
- `node-output-allowlist.ts` 를 `shared/utils/` → `nodes/core/` 로 파일 이동 (import 경로 동반 수정)
- Swagger DTO 캐너리 4개 스펙의 boilerplate 를 `shared/testing/swagger-probe.ts` 공유 헬퍼로 추출
- `tsconfig.build.json` 에 신설 `src/shared/testing/**` 를 build exclude 로 등재
- JSDoc 오탈자(`EIA-AU-09`) 정정, plan/spec 문서 동기화

마스킹 로직·allowlist 키 목록·인증 가드 로직 자체는 **바이트 단위로 보존**되었다.

## 검증 절차

1. `grep -rn "redactNodeExecutionRow\b"` (구 이름) 전수 검색 → 잔존 0건. rename 이 모든 호출부(`executions.service.ts` 2곳, docstring 표)에 완전히 전파됨을 확인.
2. `grep -rn "shared/utils/node-output-allowlist"` 전수 검색 → 잔존 0건. 파일 이동 후 소비처(`websocket.service.ts`, `interaction.service.ts`) import 경로가 모두 신규 경로(`nodes/core/node-output-allowlist`)로 갱신됨을 확인.
3. `NODE_OUTPUT_ALLOWED_KEYS` 배열 내용을 이동 전(`shared/utils/node-output-allowlist.ts`, 삭제됨)과 이동 후(`nodes/core/node-output-allowlist.ts`, 신설) diff 대조 → 완전 동일(`config`/`output`/`meta`/`port`/`status`/`formConfig`/`conversationConfig`/`buttonConfig`/`interactionType`/`payload`/`title`/`rendered`/`nodeType`). fail-closed allowlist 가 이동 중 의도치 않게 넓어지거나 좁아지지 않음.
4. `npx tsc --noEmit -p tsconfig.build.json` → 에러 0. 이어서 `--listFilesOnly` 로 실제 컴파일 대상 파일 목록을 확인해 `src/shared/testing/**`(devDependency `@nestjs/testing` 을 import 하는 `swagger-probe.ts` 포함) 가 프로덕션 빌드 대상에서 완전히 제외됨을 실측 — devDependency 가 `dist` 로 유출되어 프로덕션 설치에서 `require` 실패를 일으키는 공급망 위험이 정상적으로 차단됨.
5. `interaction-token.service.ts` 의 `verifyPerTrigger` 가 `timingSafeEqual` 을 사용함을 확인(본 diff 대상 아님, 참고용) — `interaction.guard.ts` 는 JSDoc 문구 정정 한 줄만 바뀌었고 인증 로직(`canActivate`, `deny`, `extractToken`, `readItkFromConfig`)은 무변경.

## 발견사항

- **[INFO]** 없음 — 점검 관점 8개 항목(인젝션·하드코딩 시크릿·인증/인가·입력 검증·OWASP Top 10·암호화·에러 처리·의존성 보안) 전반에서 이 changeset 이 새로 도입하는 위험은 확인되지 않았다.
  - `redact-stored-error.spec.ts` 의 `CRED = 'Bearer sk-live-abc123def456'` 는 마스킹 로직을 검증하기 위한 테스트 픽스처(가짜 자격증명 패턴)이며 실제 시크릿이 아니다. 이 리터럴은 rename 전부터 존재했고 이번 diff 는 그대로 유지한다.
  - `swagger-probe.ts` 의 에러 메시지(`schemaOf`/`propertyOf` throw)는 등록된 DTO/프로퍼티 이름 목록을 담지만, 테스트 전용 파일이며 프로덕션 빌드에서 완전히 제외됨(위 검증 4번)이 확인되어 정보 노출 표면이 아니다.

## 요약

리뷰 대상 22개 파일 중 실질 로직 변경은 함수 rename·파일 이동·테스트 헬퍼 추출뿐이며, 검증 결과 마스킹 함수 호출부·allowlist 키 목록·인증 가드 로직 모두 변경 전과 동일하게 보존되었고 stale import·누락된 호출부는 전수 검색으로 확인되지 않았다. `tsconfig.build.json` 변경은 devDependency(`@nestjs/testing`) 가 프로덕션 `dist` 로 유출되는 것을 선제적으로 막는 방어적 조치로, 오히려 공급망 위생을 개선한다. 새로운 인젝션·인증 우회·시크릿 하드코딩·안전하지 않은 암호화·민감정보 노출 경로는 발견되지 않았다.

## 위험도

NONE
