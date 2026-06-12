## 발견사항

### [WARNING] `INVALID_BOT_TOKEN` vs `BOT_TOKEN_INVALID` — 유사 의미 두 코드의 순서 반전 명명
- **target 신규 식별자**: `INVALID_BOT_TOKEN` (`codebase/frontend/src/lib/i18n/backend-labels.ts:603`, `ERROR_KO` 신규 key)
- **기존 사용처**: `BOT_TOKEN_INVALID` — `codebase/backend/src/modules/triggers/triggers.service.ts:987`, `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:94`, `spec/5-system/15-chat-channel.md:345` (provider 인증 401/403 전용 코드로 이미 정착)
- **상세**: 두 코드의 의미는 명확히 분리돼 있다. `INVALID_BOT_TOKEN`은 controller 입력 검증(누락/비-string) 단계에서, `BOT_TOKEN_INVALID`는 외부 provider `setupChannel` 401/403 응답 시 발생한다. 그러나 형식이 `INVALID_<명사>`와 `<명사>_INVALID`로 반전돼, 두 코드가 모두 존재하는 상황에서 어느 쪽이 어떤 상황인지 직관적으로 구분하기 어렵다. 특히 `backend-labels.ts`에 두 key가 나란히 위치하고(`line 603`과 `line 614`) 한국어 메시지 문구도 거의 동일하여 ("봇 토큰이 올바르지 않아요" vs "봇 토큰이 유효하지 않아요") 혼동 가능성이 있다.
- **제안**: `INVALID_BOT_TOKEN`을 `BOT_TOKEN_MISSING` 또는 `BOT_TOKEN_REQUIRED`로 rename하여 입력 검증(형식/부재) vs 인증 실패를 코드명만으로 구분되게 한다. rename은 backend throw-site(`chat-channel.controller.ts:52`), spec 표(`15-chat-channel.md §5.4`), i18n 매핑, 테스트 기댓값 4곳을 일괄 변경해야 한다. 현재 두 코드 모두 신규 노출이므로 기존 클라이언트 호환 영향은 없다.

### [INFO] `TRIGGER_NOT_FOUND` i18n 그룹 레이블 혼동 가능 — chat-channel 전용이 아닌 공용 코드
- **target 신규 식별자**: `TRIGGER_NOT_FOUND` (i18n `ERROR_KO` 신규 key, `backend-labels.ts:605`)
- **기존 사용처**: `codebase/backend/src/modules/hooks/hooks.service.ts:86` — webhook inbound 경로의 범용 404 코드. `spec/data-flow/10-triggers.md` 에도 이미 존재.
- **상세**: `backend-labels.test.ts:465` 의 `CHAT_CHANNEL_CODES` 배열에 `TRIGGER_NOT_FOUND`가 포함돼 있으나 해당 주석이 "hooks webhook inbound 경로"임을 부기하고 있다. 코드 자체는 chat-channel 고유 코드가 아니므로, 향후 "chat-channel 에러만 이 배열에 있다"고 오해한 개발자가 관련 없는 트리거 경로를 chat-channel 로직으로 착각할 수 있다.
- **제안**: `backend-labels.test.ts` 의 `CHAT_CHANNEL_CODES` 배열에서 `TRIGGER_NOT_FOUND`를 분리하거나, 배열 명칭을 `CHAT_CHANNEL_RELATED_CODES`로 변경하여 포함 의도를 명확히 한다.

### [INFO] 계획 항목 ID `G-4` — 동일 파일 내 기존 순번과 연속
- **target 신규 식별자**: `### G-4` (`plan/in-progress/cafe24-backlog-residual.md:168` 추가)
- **기존 사용처**: 같은 파일의 `G-1-remaining`, `G-2`, `G-3` — 모두 같은 cafe24 백로그 태스크 접두어 시리즈
- **상세**: `G-3` 다음으로 `G-4`가 자연 순서를 따르며 충돌 없음. 단, `plan/complete/cafe24-backlog-done.md`에 이미 완료된 G-시리즈 항목이 있는지 확인이 필요하나, `complete/` 파일에 G-4 선점 여부는 이번 diff 대상 외.
- **제안**: 필요 시 `plan/complete/cafe24-backlog-done.md`에서 G-4 미사용 여부를 확인.

---

## 요약

이번 diff에서 도입된 신규 식별자는 주로 chat-channel 에러 코드 7종의 i18n 등재, 계획 항목 `G-4` 추가, 카탈로그 generator 로직 개선이다. 가장 주의해야 할 사항은 `INVALID_BOT_TOKEN`과 `BOT_TOKEN_INVALID`의 공존으로, 두 코드가 모두 "봇 토큰 유효하지 않음"류의 의미를 가지면서 명명 패턴이 반전돼 있어 혼동 가능성이 있다. 실제 의미는 분리돼 있으나 코드명만 보고는 구분이 어렵다. 나머지 신규 식별자는 기존 사용처와 충돌하지 않는다.

## 위험도

LOW
