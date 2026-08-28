# Security Review

## 발견사항

- **[INFO]** 신뢰 경계 밖 입력이 전혀 없다 — 공격 표면 자체가 사실상 없음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts` (전체), `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts` (전체)
  - 상세: `readLockfile()`(`eslint10-unblock-guard.ts:174-176`)이 읽는 경로는 `LOCKFILE = path.join(ROOT, "pnpm-lock.yaml")`(`eslint10-unblock-guard.ts:11`)이며, `ROOT`는 `_shared.ts`의 `repoRoot()`가 `__dirname`에서 `pnpm-workspace.yaml` marker 를 찾아 고정한 값이다. 사용자 입력, 네트워크, 환경변수 어디에서도 경로/데이터를 받지 않는다. 테스트가 파싱하는 `pnpm-lock.yaml`은 저장소에 체크인된 정적 파일이고, `readPeerRanges`/`allowsEslint10`에 넘기는 값도 그 파일 또는 테스트 내 하드코딩된 `SAMPLE` 문자열뿐이다. 즉 SQL/커맨드/경로 인젝션, XSS, LDAP 인젝션 클래스가 성립할 여지가 없다(외부 입력이 프로세스 경계를 넘어 들어오는 지점이 없음).
  - 제안: 없음. 이 파일들은 vitest 로만 실행되는 repo-guard(빌드/런타임에 포함되지 않음)이므로 프로덕션 공격 표면에 영향이 없다.

- **[INFO]** 정규식은 선형(linear) 구조 — ReDoS 위험 없음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:106,115,123,138,단`(`readPeerRanges`의 키/블록/peer 정규식들과 `termMajorFloor`의 정규식)
  - 상세: `/^ {2}(?<name>@?[^@\s/]+(?:\/[^@\s]+)?)@(?<version>[^:\s]+):\s*$/`, `/^ {6}eslint:\s*(?<range>.+?)\s*$/` 등은 중첩 정량자(`(a+)+` 류)가 없고 각 문자 클래스가 서로 겹치지 않게 설계돼 있어(예: `[^@\s/]+`와 `[^:\s]+`) 한 줄(line) 단위로 선형 시간에 매칭된다. lockfile 이 6MB급이라는 주석이 있지만 매칭은 줄 단위(`lockText.split("\n")`)로 수행되므로 개별 라인 길이에만 비례한다. 입력 자체도 신뢰된 로컬 파일이라 이중으로 안전하다.
  - 제안: 없음(현행 유지).

- **[INFO]** 에러 메시지에 담기는 정보는 내부 저장소 메타데이터뿐 — 민감정보 노출 없음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:158,163-166` (`allowsEslint10` throw 문), `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:77-81,83-93`
  - 상세: throw/expect 메시지에 `JSON.stringify(range)`, 패키지명, peer range 문자열, plan 파일 경로 등을 그대로 실어 실패 원인을 상세히 알린다. 이는 오픈 리포지토리의 빌드/의존성 메타데이터이며 자격증명·PII·내부 인프라 주소 등 민감정보가 아니다. 테스트 실패 로그가 CI 콘솔에 노출되는 것을 전제로 설계된 개발자 대상 메시지로, 문제 없음.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 파일 1·2 전체
  - 상세: import·상수·literal 을 전수 확인했으며 API 키, 비밀번호, 토큰, 인증서, 접속 문자열 등이 전혀 없다. `BLOCKERS` 배열과 `SAMPLE` fixture 는 모두 npm 패키지명·semver range 문자열뿐이다.
  - 제안: 없음.

- **[INFO]** 인증/인가, 암호화, 세션 관리 해당 없음
  - 위치: 파일 1·2·3 전체
  - 상세: 이 변경분은 로컬 lockfile 을 읽어 semver 배제 여부를 판정하는 순수 함수 + vitest 스위트 + plan 문서 갱신이며, 인증/인가 로직, 암호화/해시 연산, 네트워크 전송을 전혀 포함하지 않는다. `plan/in-progress/deps-peer-gating-and-eslint10.md`(파일 3)는 문서 변경으로 실행 코드가 아니며, 본문 중 `secret-resolver`/SSRF(`#814`) 언급은 이미 처리된 과거 항목을 참조하는 서술일 뿐 이번 diff 가 그 코드를 바꾸지 않는다.
  - 제안: 없음.

- **[INFO]** 의존성 보안 — 이번 diff 는 신규 의존성을 추가하지 않음
  - 위치: 파일 1·2 (`import` 목록)
  - 상세: 사용하는 것은 `node:fs`, `node:path`, `vitest`(`describe/expect/it`) — 모두 기존에 이미 워크스페이스에 존재하는 것들이다. `pnpm-lock.yaml`/`package.json` 자체의 버전 정책 변경(예: eslint 계열 patch bump)은 이 review 대상 diff 범위 밖(파일 3 은 그 판단을 기록한 plan 문서일 뿐, 실제 manifest 변경 커밋이 아님)이라 별도 검토 불필요.
  - 제안: 없음.

## 요약

이번 변경분은 프로덕션 런타임에 포함되지 않는 repo-guard 테스트 코드(`eslint10-unblock-guard.ts`, `eslint10-unblock.test.ts`)와 그 배경을 기록한 plan 문서(`deps-peer-gating-and-eslint10.md`) 갱신으로 구성된다. 외부/사용자 입력을 전혀 받지 않고 로컬에 체크인된 `pnpm-lock.yaml`·`package.json`만 읽어 semver peer range 를 파싱·판정하는 순수 로직이라 인젝션, 인증/인가, 암호화, 시크릿 노출 등 OWASP Top 10 관점의 공격 표면이 사실상 존재하지 않는다. 정규식들도 중첩 정량자가 없는 선형 구조라 ReDoS 우려도 없다. 보안 관점에서 지적할 결함은 발견되지 않았다.

## 위험도

NONE
