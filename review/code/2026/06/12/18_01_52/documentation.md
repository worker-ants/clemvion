# 문서화(Documentation) Review

## 발견사항

### 파일 2: triggers.mdx — Chat Channel error code callout 수정

- **[INFO]** 오류 메시지 표현 개선 — 사실 정확성 향상
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` line 632
  - 상세: `"일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요"` → `"한국어 화면에서는 모두 한국어 안내 메시지로 표시돼요"` 로 변경. `backend-labels.ts` 의 `ERROR_KO` 에 해당 코드들이 등록(파일 4)되었으므로 callout 내용이 코드 현실과 일치하게 된 올바른 수정.
  - 제안: 이상 없음. 변경 이유를 `triggers.mdx` 자체의 주석이나 별도 commit message 에 `backend-labels.ts` 추가와의 연관성을 언급하면 좋으나, 현재 plan 파일(파일 1)과 `backend-labels.test.ts` 인라인 주석이 근거 chain 을 제공하므로 추가 문서는 필수 아님.

- **[INFO]** `WORKSPACE_ID_REQUIRED` 코드가 callout 목록에 없음
  - 위치: `triggers.mdx` line 632 (Chat Channel error code callout)
  - 상세: `backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 에는 `WORKSPACE_ID_REQUIRED` 가 추가되지 않았고 `triggers.mdx` callout 목록에도 없다. `backend-labels.ts` 의 `ERROR_KO` 에는 `WORKSPACE_ID_REQUIRED` 가 이미 존재(line 1748). 단, 이 코드는 chat-channel 전용이 아니라 공용 데코레이터 코드이므로 목록 생략이 의도적일 수 있다. 문서 독자가 이 코드를 chat-channel 흐름에서 만날 수 있으나 callout 에 언급이 없어 혼란 가능성이 있음.
  - 제안: chat-channel context 에서 실제로 이 코드가 반환될 수 있는지 확인 후, 반환된다면 callout 에 추가하거나 "공통 에러 코드는 별도 문서 참조" 안내를 추가하는 것을 검토.

---

### 파일 3: backend-labels.test.ts — i18n parity guard 확장

- **[INFO]** 인라인 주석이 spec SoT 참조를 명확히 제공
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` lines 665–666
  - 상세: 추가된 chat-channel 에러 코드 블록에 `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4).` 와 노출 컨텍스트 설명이 함께 달려 있어 유지보수자가 근거를 찾기 쉽다. 기존 SSRF 코드 블록 주석 스타일과 일관성이 유지됨.
  - 제안: 이상 없음.

- **[INFO]** `WORKSPACE_ID_REQUIRED` parity 가드 미포함
  - 위치: `backend-labels.test.ts` `LOCALIZED_ERROR_CODES` 배열
  - 상세: 파일 4 에서 `WORKSPACE_ID_REQUIRED` 는 `ERROR_KO` 에 이미 등록되어 있으나 parity guard 배열에는 없다. 명시적 ratchet 에서 제외된 것이 의도라면 주석으로 이유를 표기하면 추후 리뷰어 혼동을 줄일 수 있다.
  - 제안: `WORKSPACE_ID_REQUIRED` 제외가 의도적이라면 `// 공용 데코레이터 코드 — chat-channel 전용 아님, 별도 관리` 형태의 짧은 주석 추가 권장(LOW).

---

### 파일 4: backend-labels.ts — ERROR_KO 신규 항목

- **[INFO]** 인라인 주석이 spec 참조와 노출 컨텍스트를 적절히 제공
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` lines 1156–1157
  - 상세: `// chat-channel API 에러 코드 (spec/5-system/15-chat-channel.md §5.4 실패 응답).` 와 사용자 노출 시점 설명이 있어 테이블 자체의 주석 패턴(SSRF 코드 블록, CODE 코드 블록)과 일관성 유지. 영문 SoT 출처(`// 영문 SoT 는 각 throw-site.`)도 명시되어 있어 양방향 추적 가능.
  - 제안: 이상 없음.

- **[INFO]** `TRIGGER_NOT_FOUND` 한국어 설명이 chat-channel 맥락 없이 범용적
  - 위치: `backend-labels.ts` line 1780
  - 상세: `"해당 웹훅 엔드포인트를 찾을 수 없어요."` — `TRIGGER_NOT_FOUND` 는 chat-channel 처리 흐름에서 나오지만 한국어 설명은 "웹훅 엔드포인트"로 표현되어 있어 사용자가 트리거 자체를 찾지 못하는 경우와의 구분이 모호할 수 있다. 기능상 문제는 없음(graceful fallback 이 있음).
  - 제안: 현재 표현으로 운영 가능하나, 차후 "해당 트리거(채팅 채널)를 찾을 수 없어요." 로 더 구체화하는 것을 권장(INFO).

---

### 파일 6: _generator.py — 컨테이너 cross-map fallback 수정

- **[INFO]** 수정 논리가 코드 주석으로 충분히 설명됨
  - 위치: `spec/conventions/cafe24-api-catalog/_generator.py` lines 2001–2006 (diff 기준)
  - 상세: `# 컨테이너(obj/arr)는 req/global/variant 의 스칼라 파라미터 설명을 빌려오면 / 의미가 어긋난다 (예: 응답 래퍼 order 가 정렬 쿼리 파라미터 order 의...` 인라인 주석이 버그 원인과 수정 이유를 정확히 서술. 모듈 docstring(`resp_param_rows` 함수 docstring, lines 2368–2372)에는 "설명 우선순위: (1)→(2)→(3)→(4)" 설명이 있으나 이 예외(컨테이너 제외)는 반영되지 않았다.
  - 제안: `resp_param_rows` 함수 docstring 의 우선순위 설명에 "(스칼라 전용 — 컨테이너는 cross-map fallback 미적용)" 한 줄 추가 권장(LOW).

- **[INFO]** 모듈 docstring이 변경을 반영하지 않음
  - 위치: `_generator.py` 모듈 수준 docstring (lines 2016–2052)
  - 상세: 모듈 docstring은 전반적인 동작을 설명하지만, 이번 수정(컨테이너 필드의 의미 어긋남 방지)을 명시하지 않는다. 단, 이는 내부 구현 세부사항이므로 모듈 docstring 수준의 변경이 반드시 필요하지는 않음.
  - 제안: 현재 수준으로 충분. 변경 불필요.

---

### 파일 7: appstore-orders.md — 생성 산출물 정정

- **[INFO]** 생성 산출물 변경 — 문서화 관점 무결성 유지
  - 위치: `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` lines 46, 94 (diff 기준)
  - 상세: `order` 컨테이너 필드의 설명이 `"정렬 순서 asc : 순차정렬 · desc : 역순 정렬"` (쿼리 파라미터 설명 오기입) → `"(응답 객체)"` (정확한 유형 라벨)로 정정. `_generator.py` 의 버그 수정(파일 6)에 의한 올바른 재생성 결과. 문서 의미 정확성이 향상됨.
  - 제안: 이상 없음.

---

### 파일 5: spec-sync-chat-channel-gaps.md — worktree 상태 정정

- **[INFO]** frontmatter `worktree` 값 수정
  - 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter
  - 상세: `worktree: spec-sync-audit` → `worktree: (unstarted)` 로 수정. plan lifecycle 규약에 따르면 미착수 태스크의 worktree 필드는 `(unstarted)` 여야 함. 잘못된 worktree 이름이 있으면 자동화 스크립트가 실존하지 않는 worktree 를 참조할 수 있으므로 이 수정은 문서 정확성을 높임.
  - 제안: 이상 없음.

---

### 파일 1: plan/complete/fix-spec-frontmatter-catalog.md

- **[INFO]** `spec_impact` frontmatter 필드 추가로 추적 가능성 향상
  - 위치: `plan/complete/fix-spec-frontmatter-catalog.md` frontmatter
  - 상세: `spec_impact` 필드에 `spec/conventions/spec-impl-evidence.md`, `spec/conventions/cafe24-api-catalog/_overview.md` 가 열거되어, 이 plan 이 어느 spec 파일을 변경했는지 plan lifecycle 규약 내에서 추적 가능.
  - 제안: 이상 없음. 규약 준수.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. 핵심 변경(chat-channel 에러 코드 i18n 추가)은 `backend-labels.ts` 의 인라인 주석, `backend-labels.test.ts` 의 spec 참조 주석, `triggers.mdx` callout 수정이 삼각 일관성을 이루고 있어 독자가 변경 배경을 추적하기 쉽다. `_generator.py` 의 컨테이너 fallback 수정도 인라인 주석이 버그 원인을 명확히 설명하며, 유일하게 개선이 권장되는 부분은 `resp_param_rows` 함수 docstring 이 새 제약(컨테이너 제외 규칙)을 아직 반영하지 않은 점이다. WORKSPACE_ID_REQUIRED 코드의 parity guard 미포함 및 triggers.mdx callout 미기재는 의도적 생략으로 추정되나 짧은 이유 주석이 없어 차후 리뷰어 혼동 가능성이 남는다. 전반적으로 심각한 문서화 결함은 없으며 대부분의 발견사항은 LOW/INFO 수준이다.

## 위험도

LOW

STATUS: SUCCESS
