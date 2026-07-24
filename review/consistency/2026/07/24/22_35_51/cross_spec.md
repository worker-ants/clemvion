### 발견사항

- **[INFO]** `2-sdk.md §3` 의 "중복 시작 없음" 서술과 `3-auth-session.md §3.1` 의 apiBase 바인딩 예외 관계를 명시적으로 교차 참조하면 좋음
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §3 "`wc:boot` 재전송(멱등 재설정)" — "동일 `triggerEndpointPath` 로의 재부팅은 진행 중 execution 을 중복 시작하지 않는다(eager-start 가드 · 세션 복원)"
  - 충돌 대상: `spec/7-channel-web-chat/3-auth-session.md` §3.1-1 (신규 추가분) — "저장 세션은 발급된 `apiBase`(origin)에 묶인다: 현재 `apiBase` 와 불일치하거나 기록돼 있지 않으면 폐기하고 신규로 시작한다"
  - 상세: `2-sdk.md` 의 "중복 시작 없음" 보장은 "세션 복원"이 성공한다는 전제에 의존한다. 이번 변경으로 세션 복원은 발급 당시 `apiBase` 와 현재 `apiBase` 가 일치할 때만 성공하며, 재전송이 `apiBase` 를 바꾸면 의도적으로 세션이 폐기되고 새 execution 이 시작된다. 이는 실질적으로 옳은 동작(다른 API 백엔드에는 이전 execution 이 존재하지 않으므로 "중복"이 아님)이며 diff 자체 주석("오늘 무해한 이유는 유일한 재전송 경로가 apiBase 를 바꾸지 않기 때문")도 이를 인지하고 있어 **실제 모순은 아니다**. 다만 `2-sdk.md` 의 문구만 읽으면 "재부팅은 절대 execution 을 재시작하지 않는다"로 오독될 여지가 있어, `apiBase` 일치를 전제 조건으로 명시하면 두 문서 간 정합성이 더 명확해진다.
  - 제안: `2-sdk.md §3` 문장에 "(단, 재전송이 `apiBase` 를 바꾸면 3-auth-session §3.1 의 발급 origin 바인딩에 따라 세션이 폐기되고 새 execution 이 시작된다)" 같은 각주를 추가. 선택 사항이며 비차단.

### 요약
검토 대상 diff 는 `codebase/channel-web-chat` 클라이언트 세션 저장소(`session-store.ts`)에 `apiBase` 발급-origin 바인딩을 추가하는 좁고 자기완결적인 변경이다. 이 바인딩 로직은 `spec/7-channel-web-chat/3-auth-session.md §3.1`-1(신규 문구)에 이미 정확히 반영돼 있고, 관련 `code:` frontmatter(`3-auth-session.md` 가 `session-store.ts`/`use-widget.ts` 를 명시)도 정합하다. `PersistedSession`(브라우저 `sessionStorage` 전용 클라이언트 타입)은 `spec/1-data-model.md` 의 백엔드 엔티티와 이름·필드 충돌이 없고, 변경은 HTTP API 계약·요구사항 ID·RBAC·상태 머신·레이어 책임 분할 어느 것도 건드리지 않는다. `2-sdk.md §3` 의 "재부팅은 execution 을 중복 시작하지 않는다"는 일반 서술이 이번 apiBase 예외 케이스를 명시적으로 교차 참조하지 않는 점을 INFO 로 남기지만, diff 의 자체 근거(현재 유일한 재전송 경로는 apiBase 를 바꾸지 않음)로 볼 때 실질 모순은 아니다. 그 외 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다.

### 위험도
LOW
