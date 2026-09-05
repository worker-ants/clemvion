# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 설명하는 JSDoc 블록이 그 사이에 끼어든 다른 상수의
  선언·주석 때문에 대상 심볼에서 떨어져 나갔다 (문서-코드 연결 끊김).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:63-76` (블록 시작·끝),
    실제 대상 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언은 `:93-96`. 그 사이 `:77-91` 에
    `NOTIFICATION_SIGNING_STRIP_KEYS` 의 JSDoc + 선언이 끼어 있다.
  - 상세: `git blame` 으로 확인 — `dfb2664af9`(§5.4 스윕 1차, 18:22:55)가 63-76행 JSDoc(그
    내용은 "응답에서 제거할 **엔티티 컬럼**… 왜 `select: false` 가 아닌가" 로, 명백히
    `TRIGGER_RESPONSE_STRIP_COLUMNS` 하나만을 설명한다)을 그 상수 선언 바로 위에 썼다. 그런데
    이번 diff 에 포함된 후속 커밋 `cb17f08709`(19:06:13, "§5.4 금지 조합을 내가 넓혔다 — 정정 +
    래칫 가드 신설", W1 수정)가 `NOTIFICATION_SIGNING_STRIP_KEYS` 상수와 그 자신의 JSDoc(77-87행)을
    **기존 JSDoc 블록과 그 대상 선언 사이**에 삽입하면서, 원래 블록을 함께 아래로 옮기지 않았다.
    결과적으로 63-76행 JSDoc 은 코드 바로 위가 아니라 "다른 JSDoc 블록" 바로 위에 놓이게 됐다 —
    TypeDoc 류 도구는 가장 가까운 선언(`NOTIFICATION_SIGNING_STRIP_KEYS`)에 77-87행만 귀속시키고,
    63-76행은 어떤 심볼에도 붙지 않는 "떠 있는" 주석이 된다. 사람이 읽어도 "왜 select:false 가
    아닌가" 설명 직후에 맥락 없이 새 JSDoc 이 튀어나와 두 블록이 뒤섞인 것처럼 보인다.
  - 제안: 63-76행 JSDoc 블록을 `TRIGGER_RESPONSE_STRIP_COLUMNS` 선언(93행) 바로 위로 옮긴다.

- **[WARNING]** `sanitizeForResponse` 위에 오래된 JSDoc 과 이번 수정으로 새로 쓴 JSDoc 두 블록이
  나란히 남아 있다 (오래된 주석이 삭제되지 않음).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:547-557`(옛 블록,
    2026-05-24 `f4640ff2d8` 작성) + `:558-569`(새 블록, 이번 diff `dfb2664af9` 작성),
    메서드 선언은 `:570`.
  - 상세: 옛 블록(547-557)은 이 메서드가 `sanitizeChatChannelForResponse` 이던 시절의 좁은
    책임("응답 DTO 전용 derived 필드 + 내부 ref + plaintext strip", `hasBotToken` derived 필드)만
    설명한다. 이번 diff 가 메서드를 `sanitizeForResponse` 로 개명하고 책임을 "엔티티 컬럼
    스트립"·"notification.signing 스트립"까지 넓히면서 그 내용을 온전히 담은 새 JSDoc(558-569)을
    바로 위에 추가했는데, 옛 블록을 지우지 않고 그대로 둔 채 새 블록을 그 아래(코드에 더 가까운
    자리)에 끼워 넣었다. 두 블록이 겹쳐 있어 (1) 어느 쪽이 "진짜" 문서인지 혼동을 주고, (2)
    옛 블록은 지금 구현이 하는 일(entity 컬럼 축·notification.signing 축)을 언급하지 않아 그
    자체로 불완전/오래된 정보다. 동작에는 영향 없다.
  - 제안: 547-557행의 옛 JSDoc 블록을 삭제하고 558-569행 새 블록만 남긴다.

## 요약

이번 라운드는 직전 코드 리뷰(`review/code/2026/09/05/18_23_02`)와 consistency 리뷰
(`review/consistency/2026/09/05/18_23_03`)가 지적한 문서화 관련 항목 — rename 된 private
메서드(`sanitizeChatChannelForResponse` → `sanitizeForResponse`)를 가리키던 stale 주석
(`chat-channel-trigger-create.e2e-spec.ts`), `chatChannelHealth`/`notificationHealth`/
`rerankMode` 의 누락된 `enum` 선언, CHANGELOG 소제목-표 수치 불일치(24 vs 23) — 를 모두
실제로 정정했음을 `Read`/`git blame` 대조로 확인했다. CHANGELOG 의 "78건"·"17개 필드"·
"10건" 등 정량 서술도 각각 `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`
배열 길이, 초기 커밋(`dfb2664af9`)에서 금지 조합으로 선언됐던 필드 수, 기존
`execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT` 길이와 정확히 일치함을 실측
확인했다 — 문서의 정량 주장은 신뢰할 만하다. 다만 이번 diff 자신이 `triggers.service.ts` 에
두 군데 새 문서화 결함을 만들었다: (1) 나중 커밋이 상수를 문서 블록과 그 대상 선언 사이에
끼워 넣어 기존 JSDoc 을 대상에서 떼어냈고, (2) 메서드 rename·책임 확장 시 옛 JSDoc 을 지우지
않고 새 JSDoc 을 나란히 추가해 중복·불완전 문서가 남았다. 둘 다 같은 패턴 — "기존 주석/코드
사이에 새 내용을 끼워 넣을 때 인접 문서를 함께 옮기거나 정리하지 않음" — 이라 다음 라운드
에서도 재발할 여지가 있다. 기능·보안 영향은 없다.

## 위험도

LOW
