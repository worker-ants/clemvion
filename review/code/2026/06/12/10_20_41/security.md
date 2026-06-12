# 보안(Security) 리뷰 결과

리뷰 대상: `test-code-http-hardening` 그룹3 — 테스트 보강 + W14 주석 수정 + plan 체크박스 갱신
실제 변경 범위: 6파일 / +220 / -9
(code/http/i18n 테스트 + W14 주석 off-by-one 수정 + plan 체크박스)

---

## 발견사항

### [INFO] dry-run 분기가 SSRF 가드를 우회하는 설계 — `__dryRun` 플래그 주입 경로 감사 필요
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 라인 ~251-280 (dry-run test.each)
- **상세**: dry-run 경로는 실제 fetch 없이 mock 응답을 즉시 반환하므로 SSRF 가드가 실행되지 않는다. 신규 테스트가 `fetchSpy not called` + `_dryRun === true` + `wouldHaveCalled.kind === 'http_request'` 로 dry-run 계약을 검증하는 것은 올바르다. 보안 관점의 잠재 위험은 `context.variables.__dryRun` 플래그의 설정 출처다 — 외부 사용자가 이 플래그를 직접 주입할 수 있는 채널이 존재한다면 의도적으로 SSRF 가드를 우회하는 경로가 열린다. 본 diff 에서 해당 플래그 출처 코드는 변경되지 않았으므로 본 PR 의 직접 취약점은 아니나, dry-run 경로 확장 시 반드시 검토해야 하는 보안 갭이다.
- **제안**: `context.variables.__dryRun` 을 설정할 수 있는 경로(API 핸들러, 플로우 실행 엔진 등)를 감사하고, 외부 입력에서 해당 플래그가 신뢰 없이 전달되지 않는지 확인한다.

### [INFO] SSRF 차단 경로에서 URL userinfo 자격증명 미노출 — 테스트로 계약 검증 완료
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 라인 ~282-301
- **상세**: `http://alice:s3cr3t@10.0.0.5/internal` 형식의 URL 에서 SSRF 차단 발생 시 `result.config.url` 에 `alice`, `s3cr3t` 가 포함되지 않음을 단언하는 테스트가 추가됐다. OWASP A02(민감 데이터 노출) 관점에서 자격증명이 에러 응답 config echo 에 포함되지 않도록 검증하는 올바른 보안 계약 단언이다.
- **제안**: 없음.

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS=true` 단일 플래그 — 프로덕션 오구성 시 전 노드 SSRF 방어 전역 비활성화
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 라인 ~219-247 (opt-out 테스트)
- **상세**: 신규 opt-out 테스트가 `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 시 사설 주소 요청이 통과함을 검증한다. 이 환경변수 하나가 HTTP/DB/Email 통합 노드 SSRF 방어를 동시에 비활성화하는 설계는, 프로덕션 배포 시 실수로 활성화될 경우 전체 SSRF 방어가 무력화되는 단일 장애점(SPOF)이다. 이전 세션 SUMMARY(10_07_06) INFO-6 에서도 동일하게 지적된 바 있다.
- **제안**: 서버 시작 시 `ALLOW_PRIVATE_HOST_TARGETS=true` 감지 시 WARN 레벨 로그("SSRF 방어가 비활성화되어 있습니다 — 프로덕션 환경에서 사용하지 마세요")를 출력한다. CI 파이프라인 프로덕션 환경 변수 검증 게이트 추가를 권장한다.

### [INFO] `_retry_state.json` 의 개발자 로컬 절대 경로 — 공개 저장소 기준 이력 노출 위험
- **위치**: `review/code/2026/06/12/10_07_06/_retry_state.json` (`session_dir`, `summary_output_file`, 각 `prompt_file`/`output_file` 필드)
- **상세**: `/Volumes/project/private/clemvion/...` 형태의 로컬 절대 경로가 저장소에 커밋된다. 저장소가 공개되거나 제3자에게 공유될 경우 개발자 로컬 시스템 디렉터리 구조가 git 이력에 영구 노출된다. 이전 세션 SUMMARY(10_07_06) INFO-7 에서도 동일하게 지적됐다.
- **제안**: 저장소가 공개될 가능성이 있다면 `review/**/_retry_state.json` 을 `.gitignore` 에 추가하거나, 절대 경로 대신 저장소 루트 기준 상대 경로로 저장하도록 생성 스크립트를 수정한다.

---

## 요약

본 PR 의 실제 변경(6파일 / +220 / -9)은 SSRF 가드 검증 테스트 추가, W14 주석 off-by-one 수정, i18n 매핑 테스트 추가, plan 체크박스 갱신으로 구성된다. 추가된 테스트 코드 자체에는 보안 취약점이 없으며, SSRF 차단 경로 URL 자격증명 미노출 단언과 dry-run fetchSpy 미발생 검증 등 기존 보안 계약을 올바르게 검증하는 내용이다. INFO 수준의 관찰로는 (1) dry-run `__dryRun` 플래그의 외부 주입 가능 여부 감사, (2) `ALLOW_PRIVATE_HOST_TARGETS` 프로덕션 활성화 시 경고 로그 권장, (3) `_retry_state.json` 절대 경로 하드코딩의 이력 노출 위험이 있다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 인증 우회, 불안전 암호화 알고리즘 사용 등의 취약점은 본 diff 에서 발견되지 않는다.

## 위험도

LOW
