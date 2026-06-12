# 부작용(Side Effect) Review

## 발견사항

### 파일 4: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** `ERROR_KO` 모듈 레벨 객체에 신규 키 7개 추가 — 기존 매핑 덮어쓰기 없음
  - 위치: `backend-labels.ts` `ERROR_KO` 추가 항목 (`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)
  - 상세: `ERROR_KO`는 `export const`로 선언된 모듈 레벨 객체다. 새 키를 추가하는 것이므로 기존 키에 부작용 없다. `translateBackendError` 함수가 이 객체를 읽는 동작에서, 이전에 `fallback` 문자열을 반환하던 코드들이 이제 한국어 메시지를 반환한다. 이는 의도된 동작 변경이며 breaking change가 아닌 opt-in 확장이다.
  - 제안: 이상 없음.

- **[INFO]** `TRIGGER_NOT_FOUND` 번역이 chat-channel 외 경로에서도 적용됨
  - 위치: `backend-labels.ts` `TRIGGER_NOT_FOUND` 항목
  - 상세: `TRIGGER_NOT_FOUND` 는 `HooksService` (hooks.service.ts) 의 일반 webhook inbound 경로에서도 발생할 수 있는 코드다. 이번 변경 전에는 해당 코드가 `ERROR_KO`에 없어 `translateBackendError`가 `fallback`을 반환했다. 추가 후에는 chat-channel 맥락 밖에서도 "해당 웹훅 엔드포인트를 찾을 수 없어요."라는 한국어 메시지가 노출된다. "웹훅 엔드포인트"라는 표현은 채팅 채널 맥락에서는 충분히 적합하나, 일반 트리거 not-found 상황에서는 다소 부정확할 수 있다. 기능 결함은 아니나 의도치 않은 부작용으로 볼 수 있다.
  - 제안: `TRIGGER_NOT_FOUND`가 chat-channel 전용 코드인지 확인. 일반 webhook 경로에서도 사용된다면 "해당 트리거를 찾을 수 없어요."처럼 더 중립적인 표현이 적절하다.

---

### 파일 3: codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts

- **[INFO]** `LOCALIZED_ERROR_CODES` 정적 배열 확장 — P3-C-2 테스트 검증 범위 변경
  - 위치: `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열
  - 상세: 테스트 파일의 정적 배열에 8개 코드 추가로 P3-C-2 guard의 검증 범위가 넓어진다. 모듈 레벨 상태 변경은 없다. 추가된 코드들이 `ERROR_KO`에 존재하므로 기존 통과 테스트는 그대로 통과한다. 의도치 않은 부작용 없음.
  - 제안: 이상 없음.

---

### 파일 6 (프롬프트 외 참조): spec/conventions/cafe24-api-catalog/_generator.py

- **[WARNING]** `resp_param_rows` 함수 내 cross-map fallback 조건 변경 — generator 재실행 시 파일시스템 광범위 변경 유발 가능
  - 위치: `_generator.py` `resp_param_rows` 함수 내 `if kind not in ('obj', 'arr')` 조건 추가
  - 상세: 이 변경은 스크립트가 재실행될 때 `spec/conventions/cafe24-api-catalog/` 하위의 field-level `.md` 파일 중 응답 래퍼 이름과 요청 파라미터 이름이 충돌하는 모든 entity 파일에 대해 설명 텍스트가 변경된다. 현재 커밋은 `appstore-orders.md` 한 파일만 반영했지만, 동일 패턴을 가진 `order/orders.md`, `store/orders-setting.md` 등 최소 8개 파일이 재생성 시 자동 변경된다. 이는 의도된 버그픽스의 파생 효과이나, CI 또는 개발자가 generator를 재실행하면 예상보다 광범위한 파일 변경이 발생한다.
  - 제안: RESOLUTION.md와 `cafe24-backlog-residual.md §G-4`에 이미 명시된 대로, 재생성 시 추가로 변경되는 파일들을 후속 PR에서 일괄 커밋해야 한다. 의도치 않은 변경이 아니나, 재실행 전 팀 공유 필요.

- **[INFO]** `fetch_entity_json()` 의 `entity_id` 기반 캐시 파일 경로 쓰기 — 파일시스템 부작용
  - 위치: `_generator.py` `fetch_entity_json()` 함수의 `with open(cache, "w", ...)` 라인
  - 상세: 이번 diff에서 해당 함수는 변경되지 않았다. 기존 코드이며, `entity_id`를 그대로 캐시 경로에 사용하는 패턴은 개발자 전용 CLI 도구 맥락에서 허용 가능한 수준이다.
  - 제안: 변경 범위 밖이므로 본 리뷰의 차단 사유는 아님.

---

### 파일 7 (프롬프트 외 참조): spec/conventions/cafe24-api-catalog/application/appstore-orders.md

- **[INFO]** generator 재실행 결과물 — `order` 컨테이너 필드 설명 정정
  - 위치: `appstore-orders.md` lines 46, 94
  - 상세: "정렬 순서 asc : 순차정렬 · desc : 역순 정렬" → "(응답 객체)"로 변경. 정적 문서 변경이며 런타임 부작용 없음. 파일 6의 generator 로직 수정의 직접 결과물로서 일관성이 있다.
  - 제안: 이상 없음.

---

### 파일 1 & 2 (triggers.en.mdx / triggers.mdx)

- **[INFO]** 문서 텍스트 변경 — 런타임 부작용 없음
  - 위치: MDX 파일 Chat Channel error code Callout 섹션
  - 상세: 렌더링되는 문서 문자열만 변경되며 런타임 상태·API·이벤트에 영향 없음. `triggers.en.mdx` 변경은 이전 리뷰에서 누락된 EN 문서 동반 갱신을 완료한 것이다.
  - 제안: 이상 없음.

---

### 파일 5, 7 (plan/complete, plan/in-progress)

- **[INFO]** plan 문서 frontmatter 변경 — 런타임 부작용 없음
  - 위치: `plan/complete/fix-spec-frontmatter-catalog.md` frontmatter, `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter
  - 상세: `spec_impact` 필드 추가와 `worktree: spec-sync-audit` → `(unstarted)` 변경은 순수 메타데이터 변경이다. plan lifecycle 파서가 `worktree` 값으로 실제 git worktree 존재를 검증하는 경우 `spec-sync-audit` 참조가 사라졌으므로 오히려 올바른 정리다.
  - 제안: 이상 없음.

---

## 요약

이번 변경 set 전반에서 의도하지 않은 부작용은 대부분 없다. 주목할 유일한 부작용 관련 사항은 두 가지다. 첫째, `ERROR_KO`에 `TRIGGER_NOT_FOUND` 한국어 번역을 추가함으로써 chat-channel 외 일반 webhook 경로에서도 "웹훅 엔드포인트" 표현이 노출될 수 있으나, 이는 기능 결함이 아닌 표현의 범용성 문제이며 INFO 수준이다. 둘째, `_generator.py`의 `resp_param_rows` 조건 변경은 스크립트 재실행 시 현재 커밋에 반영된 `appstore-orders.md` 외에도 최소 8개 이상의 field-level 카탈로그 파일이 추가로 변경되는 파일시스템 부작용을 가지며, 이는 RESOLUTION.md와 `cafe24-backlog-residual.md §G-4`에 명시된 의도된 후속 작업이나 재실행 시 팀 내 공유가 필요한 WARNING 수준이다. `ERROR_KO` 객체 확장, 테스트 배열 확장, 문서 텍스트 변경은 모두 의도된 범위 내의 additive 변경으로 기존 동작에 부작용이 없다.

## 위험도

LOW

STATUS: SUCCESS
