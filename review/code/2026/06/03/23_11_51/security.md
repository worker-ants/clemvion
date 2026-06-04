# Security Review

## 발견사항

### 변경 코드 (diff) 분석

- **[INFO]** 단순 YAML frontmatter 참조 변경 — 보안 영향 없음
  - 위치: `spec/conventions/conversation-thread.md` frontmatter, `pending_plans` 키
  - 상세: `plan/in-progress/ai-context-memory-auto.md` → `plan/in-progress/ai-context-memory-followup-v2.md` 로 플랜 파일 경로 문자열 교체. 순수한 메타데이터 수정으로 인젝션 벡터, 시크릿, 인증/인가, 입력 검증, 암호화, 에러 처리, 의존성 등 보안 관련 항목 어느 것도 해당하지 않는다.
  - 제안: 해당 없음.

---

### 전체 파일 컨텍스트 분석 (spec/conventions/conversation-thread.md)

이 파일은 코드가 아닌 제품 명세(spec) 문서이므로 직접 실행되거나 런타임에 처리되지 않는다. 그러나 보안 설계 의도가 문서에 명시되어 있어 아래 항목을 점검했다.

- **[INFO]** Prompt Injection 방어 마커 설계 — §1.6 / §9.5
  - 위치: §1.6 "LLM-facing 보안 마커", §9.5 "LLM-facing 마커의 UI strip"
  - 상세: `[user-input]…[/user-input]` 마커를 통한 사용자 입력 구분, 마커 내부 토큰 재등장 시 zero-width separator escape, UI 노출 전 strip 정규식(`/\[\/?user-input\]/g`) 적용 등 prompt injection 방어 설계가 스펙에 명시되어 있다. 설계 자체는 적절하며 실제 구현 적용 여부는 코드 레벨 리뷰 범위(backend `thread-renderer.ts`, frontend 변환 함수들)에서 검증되어야 한다.
  - 제안: 구현 코드 리뷰 시 `renderInteractionText`의 escape 로직과 strip 정규식이 spec과 일치하는지 확인 권장.

- **[INFO]** 시스템 에러 메시지 노출 설계 — §1.2.1 / §9.1
  - 위치: §1.2.1 `system_error` data shape, §9.1 source 별 시각 매핑
  - 상세: `system_error` turn의 `data.message`에 "LLM provider 의 에러 텍스트"가 그대로 UI에 표시되도록 설계되어 있다. LLM provider가 반환하는 에러 메시지에 내부 시스템 정보(모델명, 엔드포인트, 내부 trace 등)가 포함되는 경우 사용자에게 노출될 수 있다.
  - 제안: 구현 단계에서 `output.error.message`를 UI로 전달하기 전에 provider 에러의 민감 정보(내부 URL, stack trace 등)를 필터링하는 레이어 추가를 검토 권장. 현재 spec에는 이에 대한 sanitization 정책이 명시되어 있지 않다.

- **[INFO]** `ai_user` turn의 마커 wrap 미적용 — §1.4 / §1.6
  - 위치: §1.4 표 `message_received (ai_user)` 행 비고, §1.6 마커 정책 표
  - 상세: `ai_user` source(multi-turn 명시적 사용자 메시지)는 `[user-input]…[/user-input]` 마커 wrap 대상에서 제외된다고 명시되어 있다. 이는 의도된 설계로 Rationale이 "AI Agent multi-turn의 명시적 사용자 메시지로, presentation 노드를 거친 user-origin 데이터처럼 marker 식별이 필요하지 않다"고 설명한다. 단, 이 경로로 들어오는 사용자 입력 역시 prompt injection 벡터가 될 수 있으므로, LLM 호출 시 `ai_user` 메시지가 system instruction 영역과 명확히 분리되는지 구현 레벨에서 확인이 필요하다.
  - 제안: `ai_user` 입력의 messages 배열 내 role 분리(`role: 'user'`)가 반드시 지켜지는지 구현 리뷰 시 확인 권장.

- **[INFO]** Parallel 컨테이너 race condition — §2.5
  - 위치: §2.5 "nextSeq 원자성"
  - 상세: 스펙이 v1에서 Parallel 컨테이너 내 동시 turn push 시 `nextSeq` 충돌 가능성을 인지하고 "v1 은 Parallel 내부 thread 사용을 정의하지 않음"으로 미결 처리했다. 보안 취약점보다는 무결성 문제이나, 향후 Parallel 컨테이너가 thread에 write할 경우 race condition으로 인한 seq 중복 또는 데이터 혼재 가능성이 있다.
  - 제안: v2 설계 시 atomic increment(Redis `INCR` 등) 또는 mutex 전략을 스펙에 명시 권장.

---

## 요약

이번 변경은 `spec/conventions/conversation-thread.md` YAML frontmatter의 `pending_plans` 참조 경로 1줄 교체로, 보안 관점에서 어떠한 위험도 없는 순수 메타데이터 수정이다. 전체 파일 맥락에서는 prompt injection 방어(`[user-input]` 마커, strip 정규식), 에러 메시지 노출 설계, `ai_user` 마커 미적용 경로, Parallel race condition 등 주목할 설계 항목이 있으나 모두 스펙 수준에서 인지되고 있으며, 실제 보안 리스크 검증은 구현 코드(`thread-renderer.ts`, 변환 함수, AI Agent 핸들러) 레벨에서 이루어져야 한다.

## 위험도

NONE
