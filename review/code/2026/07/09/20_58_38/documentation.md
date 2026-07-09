# 문서화(Documentation) Review

## 리뷰 대상
- `spec/7-channel-web-chat/3-auth-session.md` (§3.1 재로드 복원 시퀀스 — durable `conversationThread` 히스토리 시드 서술 추가)
- `spec/conventions/conversation-thread.md` (§8.4 Rationale — durable `Execution.conversation_thread` 컬럼 소비처를 rehydration/SSE/`getStatus` REST 3개로 확장하는 "소비처 갱신 (2026-07-09)" 단락 추가)

두 파일 모두 spec 본문(문서) 자체의 diff이므로, 문서화 리뷰는 (a) 두 파일 상호간·타 spec(EIA §5.3/§R17, `1-widget-app.md` §2/§3.1) 과의 cross-reference 정합성, (b) 서술이 실제 구현과 맞는지, (c) frontmatter `code:` 목록의 완결성을 중심으로 검증했다. 대상 diff 만으로는 실제 구현 상태를 판별할 수 없어, 같은 PR(`origin/main...HEAD`)의 관련 코드(`use-widget.ts`, `conversation.ts`, `eia-types.ts`, `interaction.service.ts`, `1-widget-app.md`, `14-external-interaction-api.md`)를 함께 대조했다.

## 발견사항

- **[INFO]** `conversation-thread.md` frontmatter `code:` 목록에 신규 소비처 파일 미등재
  - 위치: `spec/conventions/conversation-thread.md` frontmatter `code:` (파일 상단, diff 밖)
  - 상세: §8.4 에 추가된 "소비처 갱신" 단락은 `GET /api/external/executions/:id`(`getStatus`, 구현: `codebase/backend/src/modules/external-interaction/interaction.service.ts`)가 durable `conversation_thread` 컬럼의 새 소비처임을 명문화했지만, 이 파일의 frontmatter `code:` 리스트에는 `interaction.service.ts` 가 없다(backend `shared/conversation-thread/**` 등만 등재). 다만 `spec/5-system/14-external-interaction-api.md` 의 `code:` 가 `codebase/backend/src/modules/external-interaction/**` 를 이미 포함하고 있어 spec-code-paths 가드(≥1 매치) 관점에서는 문제가 없고, EIA 문서가 해당 파일의 실질 SoT 역할을 하고 있어 기능상 공백은 아니다.
  - 제안: 선택 사항 — conversation-thread.md 자체에서도 이 소비처를 명시적으로 추적하고 싶다면 `code:` 에 `codebase/backend/src/modules/external-interaction/interaction.service.ts` 를 추가해 두 spec 문서 간 코드 귀속을 더 명확히 할 수 있다. 필수는 아님.

- **[INFO]** 새로고침 복원 서술의 "인스턴스 스위치" 문구 비대칭
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:115` (§3.1 경고 박스) vs `spec/5-system/14-external-interaction-api.md` R17 "재조정(2026-07-09)" 단락
  - 상세: EIA §R17 은 "5분 SSE buffer 만료·서버 재시작·**인스턴스 스위치**와 무관하게" 라고 서술하는 반면, 3-auth-session.md §3.1 경고 박스는 "5분 SSE buffer·서버 재시작과 무관하게"로 "인스턴스 스위치" 케이스를 생략했다. 의미상 오류는 아니고(서버 재시작이 인스턴스 재기동을 포괄적으로 함의) 실질적 혼동 유발 가능성은 낮다.
  - 제안: 완전한 정합을 원하면 3-auth-session.md 문구에도 "인스턴스 스위치"를 추가해 두 문서의 서술을 1:1로 맞출 수 있다. 우선순위 낮음.

## 검증 결과 (문제 없음으로 확인된 항목)

다음은 문서화 관점에서 특히 리스크가 있을 만한 지점이었으나, 실제 코드/타 spec 대조 결과 정합함을 확인했다:

- `3-auth-session.md` 의 "turn `source`→말풍선 role 매핑은 [1-widget-app §2]" cross-link — `1-widget-app.md` §2 메시지 리스트 행이 실제로 `presentation_user`/`ai_user`→user, `ai_assistant`/`ai_tool`/`system`→assistant 매핑을 명문화하고 있고, `codebase/channel-web-chat/src/lib/conversation.ts` 의 `roleOf`/`USER_TURN_SOURCES` 구현과 1:1 일치.
- `EIA §5.3·§R17` cross-link — `spec/5-system/14-external-interaction-api.md` 의 §5.3 예시 주석과 R17 Rationale 이 실제로 "재조정(2026-07-09)" 섹션을 갖고 있으며, "durable thread 없으면 키 생략" 서술이 `interaction.service.ts` 의 `...(conversationThread ? { conversationThread } : {})` 구현과 정확히 일치.
- `3-auth-session.md` §3.1 경고 박스의 "200+종료·404·복구불가 401 REST 분기는 여전히 미구현(Planned)" 서술 — `use-widget.ts` 의 `applyConfig`/`seedWaitingFromStatus` 가 실제로 상태코드 분기 없이 soft-fail(catch → warn) 방식으로만 동작함을 확인, 서술이 정확.
- `conversation-thread.md` §8.4 "소비처 갱신" 단락의 "이미 SSE 로 공개 중인 데이터의 REST 재노출이라 신규 민감 표면 아님" 근거 — `interaction.service.ts` JSDoc 의 보안 제약 서술과 동일한 논리로 갱신되어 있어 정합.
- `codebase/channel-web-chat/README.md` 가 이번 PR 의 신규 기능(세션 컨트롤, durable 히스토리 복원, turn source 매핑)을 이미 갱신 완료 — README 업데이트 누락 없음.
- 관련 코드(`use-widget.ts`, `conversation.ts`, `eia-types.ts`, `interaction.service.ts`)의 인라인 주석/JSDoc 품질이 전반적으로 우수 — race guard(`startGenRef`), soft-fail 정책, 타입 union 확장 사유 등이 상세히 문서화되어 있고 spec cross-ref 도 정확.
- 이 저장소에는 패키지 단위 CHANGELOG 파일이 없어(관례상 git 커밋 메시지가 변경 이력 역할) CHANGELOG 업데이트 누락 이슈는 해당 없음.

## 요약

두 spec 파일의 변경은 durable `Execution.conversation_thread` 컬럼이 park-resume 전용에서 `getStatus` REST 응답의 새로고침 히스토리 복원용 소비처로 확장된 사실을 정확하고 상세하게 문서화한다. 두 파일 상호간, 그리고 EIA(`§5.3·§R17`)·`1-widget-app.md`(§2·§3.1)·실제 구현 코드(`interaction.service.ts`, `use-widget.ts`, `conversation.ts`, `eia-types.ts`) 사이의 cross-reference 를 전수 대조한 결과 서술-구현 drift 없이 정확히 일치했고, README 도 이미 갱신되어 있다. Rationale 섹션(§8.4, R17)에 "기각한 대안"까지 포함해 결정 배경을 남긴 점도 우수하다. 발견된 사항은 모두 문서 완결성 관점의 사소한 개선 여지(INFO)일 뿐, 조치가 급한 결함은 없다.

## 위험도
NONE
