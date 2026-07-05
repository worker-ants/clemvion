# 신규 식별자 충돌 검토 결과

## 검토 대상

- target: `plan/in-progress/spec-draft-ai-context-memory-close.md` (spec draft, --spec 모드)
- 변경 성격: `ai-context-memory-followup-v2` plan 잔여 2 checkbox 완료 처리 + `plan/complete/` 이동, `webchat-widget-refactor` plan `plan/complete/` 이동, 4개 기존 spec(`0-common.md` · `1-ai-agent.md` · `17-agent-memory.md` · `conventions/conversation-thread.md`) frontmatter 의 `pending_plans` 리스트 정리 + `status` 필드(`partial → implemented`, 2건) 갱신.

## 발견사항

본 draft 는 신규 요구사항 ID, 신규 엔티티/DTO/인터페이스명, 신규 API endpoint, 신규 이벤트/메시지명, 신규 ENV var/config key, 신규 spec 파일 경로 중 **어느 것도 새로 도입하지 않는다**. 수행 내용은 다음 두 종류로 한정된다.

1. 기존 plan 파일 2건(`ai-context-memory-followup-v2.md`, `webchat-widget-refactor.md`)의 `git mv` — 파일명 변경 없이 디렉터리만 `plan/in-progress/` → `plan/complete/` 로 이동.
2. 기존 spec 4건의 frontmatter 필드(`pending_plans`, `status`) 값 수정 — 필드 자체도 기존 컨벤션(`spec/conventions/spec-impl-evidence.md` 로 추정되는 SoT)에서 이미 정의된 스키마이고, 값(`implemented`/`partial`)도 프로젝트 전역에서 이미 쓰이는 표준 상태값이다.

이 성격상 "신규 식별자 충돌" 6개 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트명 / 환경변수·설정키 / 파일 경로) 에 해당하는 신규 도입 항목이 존재하지 않아 CRITICAL/WARNING 급 충돌 후보가 없다. 확인을 위해 실제 코퍼스와 대조한 결과는 다음과 같다.

- **파일 경로 충돌(관점 6)** — `git mv` 대상 경로 `plan/complete/ai-context-memory-followup-v2.md`, `plan/complete/webchat-widget-refactor.md` 는 현재 `plan/complete/` 안에 동명 파일이 존재하지 않음을 확인(`find plan/complete -iname ...` 결과 0건). 이동 후 새로 생성되는 경로가 기존 파일과 충돌하지 않는다.
- **요구사항 ID / status 값(관점 1 확장)** — draft 가 언급하는 `status: partial → implemented` 전환은 `spec/conventions/spec-impl-evidence.md` 가 정의하는 기존 enum 값 재사용이며 새 값을 만들지 않는다. `0-common.md`/`17-agent-memory.md`/`1-ai-agent.md`/`conversation-thread.md` 의 현재 frontmatter(`pending_plans`, `status`) 를 직접 읽어 draft 표(§"pending_plans 참조 현황")의 서술과 실제 상태가 일치함을 확인했다 — 예: `1-ai-agent.md` 는 현재 `pending_plans: [ai-agent-tool-connection-rewrite, ai-context-memory-followup-v2, exec-park-durable-resume]` 3건이며 draft 가 명시한 "2개 잔존"(ai-context 제거 후)과 일치.
- **엔티티/타입명 · API endpoint · 이벤트명 · ENV/config key(관점 2·3·4·5)** — draft 본문에 이런 신규 식별자 도입 서술이 전혀 없다(순수 메타데이터/plan 라이프사이클 변경). 코퍼스(0-overview.md, 1-data-model.md 등)에도 이와 충돌할 만한 대응 항목이 없다.

## 요약

target spec draft 는 완료된 plan 을 닫고(`git mv` + checkbox 완료) 관련 spec frontmatter 의 `pending_plans`/`status` 를 실제 구현 상태에 맞춰 정리하는 순수 메타데이터/라이프사이클 정리 작업으로, 신규 식별자(요구사항 ID·엔티티·API·이벤트·ENV·파일 경로)를 전혀 도입하지 않는다. 이동 대상 plan 경로도 기존 `plan/complete/` 파일과 충돌하지 않고, 사용하는 `status` enum 값도 기존 컨벤션 재사용이다. 신규 식별자 충돌 관점에서 지적할 CRITICAL/WARNING/INFO 사항이 없다.

## 위험도

NONE
