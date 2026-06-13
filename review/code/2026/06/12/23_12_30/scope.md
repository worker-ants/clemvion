# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `database.md` 내 기존 코드 참조 (변경 외 영역 언급)
- 위치: `review/code/2026/06/12/22_49_12/database.md` — `### [INFO] onApplicationBootstrap 쿼리 — 인덱스 의존`
- 상세: 이 항목은 `chat-channel.module.ts` 의 기존(변경 없음) 부트스트랩 쿼리를 언급한다. 해당 라인은 본 PR 변경과 무관한 기존 코드이나, 리뷰 파일 내에서 INFO 수준으로 기록된 것이며 실제 코드 변경으로 이어지지 않아 범위 위반은 아님.
- 제안: 리뷰 문서의 관찰 기록이므로 조치 불필요.

### [INFO] `review/code/2026/06/12/22_49_12/` 하위 리뷰 산출물 포함 — 범위 내 AI-review 결과물
- 위치: 파일 8~18 (`review/code/2026/06/12/22_49_12/RESOLUTION.md`, `SUMMARY.md`, 각 reviewer `.md`, `meta.json`, `_retry_state.json`)
- 상세: 이 파일들은 이전 ai-review 세션(22_49_12)의 산출물과 RESOLUTION 으로, plan 규약 상 `review/code/**` 는 커밋 대상이며 gitignore 되지 않는다. MEMORY.md 에서도 "review/ 는 gitignored 아님 — SUMMARY/RESOLUTION 도 커밋"을 명시하고 있다. 본 PR 구현 후 ai-review 실행 + resolution 작성의 워크플로 강제 의무(CLAUDE.md)에 따른 정상 산출물이다.
- 제안: 범위 일탈 아님.

### [INFO] `plan/in-progress/spec-draft-cch-nf-03-rate-limit.md` 신규 생성 — spec-planner 결정 문서
- 위치: 파일 6 (`plan/in-progress/spec-draft-cch-nf-03-rate-limit.md`)
- 상세: CCH-NF-03 구현의 설계 결정 근거(큐 미채택, fixed-window 채택, fail-open 정책 등)를 담은 spec-draft 문서다. 구현 PR 에 설계 결정 문서가 함께 포함된 것은 spec+구현 동일 PR 전략(파일 내 "spec+구현 동일 PR"로 명시)에 따른 것이며, plan 규약 상 `plan/**` 파일이다. 범위 일탈로 보기 어려움.
- 제안: 조치 불필요.

### [INFO] `hooks.service.spec.ts` — `triggerRepo.update` mock 추가
- 위치: 파일 4 (`hooks.service.spec.ts`) — `useValue: { findOne: jest.fn(), save: jest.fn(), update: jest.fn().mockResolvedValue({ affected: 1 }) }`
- 상세: `triggerRepository` mock 에 기존에 없던 `update` 메서드가 추가되었다. 이는 `markChatChannelRateLimited` 가 `triggerRepository.update` 를 호출하기 때문에 필요한 변경으로, rate-limit 기능 구현 테스트를 위한 직접 필요 변경이다. 불필요한 확장이 아님.
- 제안: 조치 불필요.

## 요약

변경 범위는 CCH-NF-03 per-chat rate-limit 구현이라는 단일 목적에 집중되어 있다. 신규 서비스 파일 2개(`chat-channel-rate-limiter.service.ts`, `chat-channel-rate-limiter.service.spec.ts`), 모듈 등록(`chat-channel.module.ts`), 호출자 연동(`hooks.service.ts`, `hooks.service.spec.ts`), plan 추적 파일(`spec-draft-cch-nf-03-rate-limit.md`, `spec-sync-chat-channel-gaps.md`) 모두 해당 기능 구현에 직접 귀속된다. `review/code/22_49_12/` 산출물은 프로젝트 규약 상 커밋 의무 대상이다. 불필요한 리팩토링, 무관한 파일 수정, 의도하지 않은 포맷팅 변경, 미사용 임포트 추가 등 범위 일탈 징후는 발견되지 않는다.

## 위험도

NONE

STATUS: SUCCESS
