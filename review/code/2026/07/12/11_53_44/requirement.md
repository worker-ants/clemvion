# 요구사항(Requirement) Review — embed-config.dto.ts → embed-config-response.dto.ts rename

## 검증 방법
- `git show aba46cc90:.../embed-config.dto.ts` 와 신규 `embed-config-response.dto.ts` 를 `diff` — **바이트 단위 동일**(순수 rename, 기능/필드 변경 없음) 확인.
- `git show --summary 05a7a9fde` — git 이 100% rename 으로 인식(`git mv` 정상 사용), 실제 diff 는 `hooks.controller.ts` import 1줄 + `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 1줄만 추가 변경.
- `grep -rn "embed-config\.dto"` (구 파일명) 를 `codebase/`, `spec/` 전역에 실행 — 라이브 코드·spec 어디에도 잔존 참조 없음(과거 `review/` 이력 문서만 매치 — 이는 당시 시점 기록이라 정상).
- `find .../dto/responses -path "*.ts"` — 36개 중 리네임 후 미준수 2건(`auth/dto/responses/session.dto.ts`, `login-history.dto.ts`)만 남음 — plan 본문의 "36개 중 33개 준수, 이 파일만 위반" 서술과 정확히 일치(리네임 후 34/36).
- `spec/conventions/swagger.md §5-1` 예시(`WorkflowDto` in `workflow-response.dto.ts`) 확인 — 클래스명은 `-response` 접미사 없이 파일명에만 컨벤션이 적용되는 기존 선례와 일치. plan 이 "클래스명 `EmbedConfigDto` 유지" 로 판단한 근거가 코드베이스 실제 패턴과 부합.

## 발견사항

- **[INFO]** 클래스명 `EmbedConfigDto` 유지(파일명만 `-response` 접미사 추가)가 §5-1 규약과 정확히 일치
  - 위치: `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts:7`
  - 상세: swagger.md §5-1 은 파일 위치/명명 규약이며 예시(`WorkflowDto`/`workflow-response.dto.ts`)도 클래스명에 `-response` 를 요구하지 않는다. plan 문서의 판단(파일명만 대상)이 저장소 실제 선례와 일치해 문제 없음.
  - 제안: 없음(현행 유지가 맞음).

- **[INFO]** 잔여 비준수 2건(`session.dto.ts`, `login-history.dto.ts`)은 본 diff 스코프 밖
  - 위치: `codebase/backend/src/modules/auth/dto/responses/session.dto.ts`, `login-history.dto.ts`
  - 상세: plan 배경("36개 중 33개 준수, embed-config 만 위반")은 이번 리네임 이전 기준 서술이며, 리네임 후에도 이 2건은 여전히 미준수 상태로 남는다. 다만 이는 이번 PR 이 유래한 consistency-check 발견(단일 파일 대상)의 스코프 밖이라 이번 변경의 결함은 아니다.
  - 제안: 조치 불필요(별도 후속 검토 대상이면 새 plan).

## spec fidelity 점검
- 관련 spec: `spec/7-channel-web-chat/4-security.md` §3-①(임베드 soft 검증), frontmatter `code:` 목록.
- frontmatter `code:` 경로가 신규 파일명으로 정확히 갱신됨(`4-security.md:10`) — "강제 path mirror" 요구사항 충족.
- §3-① 본문의 `EmbedConfigDto { allowlist, enforce }` 필드 설명(빈 배열=allow-all, enforce=true+host 불일치 시 렌더/시작 거부)과 DTO 필드 JSDoc/`@ApiProperty` description 이 line-level 로 일치.
- 클래스명 자체(`EmbedConfigDto`)는 spec 본문·frontmatter 어느 쪽도 변경을 요구하지 않으며(§3-① 은 "파일명" 이 아닌 "코드 SoT" 로만 인용), 실제로 클래스명은 그대로다 — spec-code 불일치 없음.

## 요약
순수 파일명 rename(git mv) + import 경로·spec frontmatter `code:` 미러 갱신으로, 신구 파일 콘텐츠가 바이트 단위로 동일함을 직접 diff 로 확인했다. 기능·필드·클래스명·wire 계약 변경이 전혀 없어 요구사항 충족 관점에서 리스크가 없으며, swagger.md §5-1 파일명 컨벤션(리네임 후 34/36 준수)과 spec §3-① 본문 필드 정의 모두와 line-level 로 정합한다. TODO/FIXME, 엣지 케이스, 에러 시나리오, 반환값 등은 이번 diff 범위에 해당 사항 없음(로직 무변경). CRITICAL/WARNING 없음.

## 위험도
NONE
