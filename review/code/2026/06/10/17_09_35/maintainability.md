# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] spec/data-flow/10-triggers.md — §1.4 구현 갭 인라인 노트의 밀도
- **위치**: `spec/data-flow/10-triggers.md` §1.4 추가된 blockquote (4개 단락)
- **상세**: 구현 갭을 설명하는 note 블록이 단일 blockquote 안에 `is_active` 동기화 누락과 BullMQ 잔존 두 케이스를 각각 길게 서술하고 있다. 두 케이스 모두 본질은 "Trigger API 직접 호출이 Schedule/BullMQ 를 동기화하지 않는다"는 하나의 관심사인데, 각 케이스가 동일한 서두("triggers.service.ts update() 는 ... 모듈이 ... 주입하지도 않음", "DELETE /api/triggers/:id ... BullMQ job scheduler 엔트리 ... Redis 누수 + 로그 노이즈") 패턴으로 반복 서술된다. 두 갭을 sub-bullet 으로 분리해 둔 것은 좋으나, 각 bullet 내부의 단문 연쇄(`--- ... 이므로 ... 영구 skip ... 실행은 안 되나 ... Redis 누수 + 로그 노이즈`)가 한 줄에 과도하게 압축되어 있어 훑어 읽기가 어렵다.
- **제안**: 각 bullet 에서 원인·증상·영향을 짧은 문장으로 줄 분리하거나, 표 형태(`| 갭 | 증상 | 영향 |`)로 압축해 일관 패턴을 부여한다. §3.1 `is_active` 상태 표의 `false` 행이 이미 긴 설명을 담고 있으므로, 갭 본문을 §1.4 에, 상태 표는 짧은 후방 참조(`— §1.4 갭 참조`)만 두는 분리 원칙을 일관화하면 중복 설명이 줄어든다.

---

### [INFO] spec/data-flow/10-triggers.md — §1.2 "진입 앞단" note 의 길이와 범위 혼합
- **위치**: `spec/data-flow/10-triggers.md` §1.2 blockquote 마지막 단락 (추가된 `PublicWebhookThrottleGuard` 설명)
- **상세**: 원래 blockquote 는 인증·ip_whitelist·응답 코드를 다루는 하나의 흐름 요약이었는데, 새로 추가된 "진입 앞단" 단락이 rate-limit 정책·body 제한·인증 여부 분기·embed-config 엔드포인트 정보까지 단일 문장에 담아 blockquote 를 3단락짜리 혼합 노트로 만든다. 관심사가 섞여 있어 새 기여자가 "이 blockquote 가 설명하는 것은 무엇인가"를 파악하기 어렵다.
- **제안**: rate-limit 정책과 embed-config 사이드 엔드포인트는 §2.2 Redis 표나 별도 subsection (예: `#### 진입 앞단 보호 레이어`)으로 이동해 blockquote 의 역할을 "시퀀스 다이어그램 보조 설명"으로 한정한다.

---

### [INFO] spec/data-flow/11-workflow.md — §1.5 복제·내보내기·가져오기 표 내 `POST /api/workflows/:id/duplicate` 행의 강조
- **위치**: `spec/data-flow/11-workflow.md` §1.5 표 첫 행
- **상세**: "nodes/edges 는 복제하지 않는다." 를 굵게(`**...**`) 처리해 놀라운 동작임을 강조한 것은 의도적이지만, 같은 표의 다른 행(`export`, `import`)은 굵게 처리가 없다. 표 안의 선택적 강조는 "이 행이 특이하다"는 신호로 쓸 때는 유효하나, 이 패턴이 반복되면 굵게 = 구현 갭 신호인지 단순 강조인지 독자가 혼동할 수 있다.
- **제안**: 코드베이스 전반의 blockquote 갭 표기 관행(`> **구현 갭 — ...**`)을 따라 표 하단에 별도 note 로 기재하거나, 표 내 강조를 제거하고 "복제 시 노드/엣지 불포함" 을 Overview 또는 Rationale 에 명시한다.

---

### [WARNING] spec/data-flow/13-agent-memory.md (신규) — Overview 코드 진입점 목록의 경로 표기 불일치
- **위치**: `spec/data-flow/13-agent-memory.md` Overview 코드 진입점 섹션
- **상세**: 대부분의 data-flow 문서는 코드 진입점을 `모듈명/파일명.ts` 형태의 절대 경로로만 나열하는데, 본 파일은 `codebase/backend/src/...` 절대 경로와 함께 일부 항목에서 설명 접미어(`— 공유 헬퍼:`)를 인라인으로 붙이고 있다. 7개 진입점 중 5개는 `—` 로 이어지는 설명이 있고 2개는 경로만 있어 일관성이 없다. 프로젝트의 다른 data-flow 문서들(10~12번)은 경로와 설명을 ` — ` 구분자로 연결하는 패턴을 일관되게 쓰므로 이 점은 맞지만, 일부 항목은 설명이 두 줄 넘게 길어져 코드 진입점 목록의 스캔 가독성을 저해한다.
- **제안**: 한 bullet = 파일 경로 + 짧은 책임 요약(1줄 이내) 원칙을 지킨다. 더 긴 설명이 필요한 항목(예: `agent-memory-injection.ts` 의 두 헬퍼 역할 설명)은 §1.1/§1.2 본문으로 이동한다.

---

### [INFO] spec/data-flow/13-agent-memory.md — 핵심 불변식과 Overview System role 의 중복 서술
- **위치**: `spec/data-flow/13-agent-memory.md` Overview 첫 단락과 "핵심 불변식" bullet
- **상세**: "hot path 비차단" 불변식에서 "enqueue 까지만 await 하고 추출 LLM 콜은 worker 에서 일어난다"는 내용이 §1.1 시퀀스 다이어그램의 첫 번째 흐름 설명과 사실상 동일하게 반복된다. 불변식 정의 자체는 가치 있지만 구체 설명이 반복 기재되어 문서 길이를 늘린다.
- **제안**: 불변식 bullet 은 한 줄 단언("enqueue 만 await — 추출 콜은 worker 전담")으로 단축하고 상세 설명은 §1.1 에만 둔다.

---

### [INFO] spec/data-flow/14-chat-channel.md (신규) — §1.1 `ChannelUpdate.command` 분기 표와 시퀀스 다이어그램의 중복
- **위치**: `spec/data-flow/14-chat-channel.md` §1.1
- **상세**: 시퀀스 다이어그램에서 이미 `신규 대화 (start 또는 활성 없음/terminal)` 분기로 `execute() + ConversationState upsert`를 표현하고 있고, 그 아래 표에서도 `신규 대화 (위 외) | execute() + ConversationState upsert` 행이 별도로 있다. 동일 케이스가 다이어그램과 표 두 곳에 기술되어 있어 향후 변경 시 두 곳을 모두 수정해야 한다.
- **제안**: 다이어그램에서 커버된 케이스는 표에서 "위 다이어그램 참조"로 간략 처리하거나, 표는 시퀀스에 표현하기 어려운 케이스(멀티-command 세부 처리 분기)만 다룬다는 원칙을 명시한다.

---

### [INFO] spec/data-flow/15-external-interaction.md (신규) — §1.5 구현 갭의 Rationale 내 재언급
- **위치**: `spec/data-flow/15-external-interaction.md` §1.5 본문과 Rationale `§1.5 구현 갭을 본문에 남긴 이유`
- **상세**: §1.5 본문 blockquote 에서 구현 갭을 설명하고, Rationale 에서 "왜 본문에 남겼는가"를 다시 설명하는 이중 구조는 의사결정 근거를 분리하는 좋은 관행이지만, §1.5 본문 자체가 이미 `secretRef 우선순위 충돌 → 승격 후에도 구 secret 으로 서명 → 다음 trigger update 시 마이그레이션`이라는 인과 흐름을 자세히 서술하고 있고, Rationale 에서도 같은 인과 흐름을 재서술한다. 이는 별도 문서나 plan 에서 다뤄야 할 분량의 구현 갭 분석이 spec data-flow 문서에 이중 적재된 패턴이다.
- **제안**: Rationale 의 "§1.5 구현 갭을 본문에 남긴 이유" 섹션은 "인과 흐름" 재서술 없이 "보안 운영 영향 + plan 추진 여부" 두 문장 정도로 압축한다. 상세 인과는 §1.5 본문 한 곳에만 둔다.

---

### [INFO] spec/data-flow/2-auth.md — §1.7 비밀번호 재설정 섹션의 번호 목록 vs 나머지 섹션의 산문 혼용
- **위치**: `spec/data-flow/2-auth.md` §1.7
- **상세**: 기존 섹션들(§1.1~§1.6)은 시퀀스 다이어그램 또는 산문 + blockquote 패턴을 쓰는데, §1.7 만 `1. POST ... 2. POST ...` 번호 목록으로 4개 엔드포인트를 나열한다. 이 패턴은 다른 섹션과 형식이 달라 문서 전체를 훑을 때 시각적 단절이 발생한다.
- **제안**: 4개 엔드포인트를 표(`| 엔드포인트 | 동작 | 보안 정책 |`)로 통일하거나, 분량 상 다이어그램이 불필요한 경우 다른 "설명 섹션"과 동일하게 산문 + blockquote 형식으로 전환한다.

---

### [INFO] spec/data-flow/3-execution.md — 코드 진입점 목록에서 잘린 경로
- **위치**: `spec/data-flow/3-execution.md` 코드 진입점 목록 (diff 일부 truncated 구간)
- **상세**: diff 에서 `codebase/backend/src/modules/` 이후 경로가 잘린 채 표시된다 (`codebase/backend/src/modules/`만 있고 파일명이 없는 bullet). 이는 원본 파일의 실제 잘림인지 diff 렌더링 아티팩트인지 확인이 필요하다. 만약 실제 파일에도 잘린 경로가 있다면 코드 진입점 목록이 미완성인 상태다.
- **제안**: 해당 bullet 경로를 완전한 파일명으로 마무리한다.

---

### [INFO] spec/data-flow/4-file-storage.md — 코드 위치 라인 번호 → 함수명 전환의 일관성
- **위치**: `spec/data-flow/4-file-storage.md` §1.1, §3.1
- **상세**: 이번 변경에서 `knowledge-base.service.ts:723, 756` 같은 라인 번호 참조를 `uploadDocument` / `removeDocument` 같은 함수명으로 교체한 것은 좋은 개선이다. 그러나 같은 파일 Rationale 마지막 문장에 `try/catch warn` 설명이 아직 "어느 함수인지" 없이 서술되어 있어 (변경 후에도 함수명은 있으나 파일 내 위치 추적 단서가 없다) 일관성이 완전하지 않다. Rationale 은 원래 설계 근거 섹션이므로 코드 위치 언급이 필요 없는 부분이기도 하다.
- **제안**: Rationale 에서는 코드 위치 참조를 제거하거나 `§1.1` 크로스 레퍼런스로 대체한다.

---

### [WARNING] spec/data-flow/7-llm-usage.md — chat 계열 Caller 표의 "attribution 갭" note 내 중복 서술
- **위치**: `spec/data-flow/7-llm-usage.md` §1.3 Caller 카탈로그 표 하단 blockquote
- **상세**: `> **attribution 갭**: 현재 workflow_id 를 채우는 caller 는 Workflow Assistant 뿐이다. AI 노드 3종이 ... 전부 누락된다.` 라는 note 와, 바로 이어지는 Rationale 섹션 `llm_usage_log 의 nullable context 컬럼들 — 의도 vs 실제 채움 현황` 에서 동일한 attribution 갭 사실이 두 단락에 걸쳐 재서술된다. 두 곳 모두 "AI 노드 핸들러가 ExecutionContext ID 들을 LlmCallContext 로 전달하지 않는다"는 동일 원인을 설명한다.
- **제안**: §1.3 의 note 는 "워크플로우별 집계에서 노드 발 호출이 누락된다 — 상세는 Rationale 참조" 수준의 한 줄로 단축하고, 인과 분석과 의사결정 대상은 Rationale 에 일원화한다.

---

### [INFO] spec/data-flow/9-observability.md — §1.3 평가 정책 bullet 의 길이 편차
- **위치**: `spec/data-flow/9-observability.md` §1.3 새로 추가된 bullet 4개
- **상세**: 4개 bullet 중 "최소 표본 가드"(3줄)와 "breach 판정 strict 초과"(2줄)는 간결한 반면, "window 파싱 fallback" bullet 은 regex 파서 지원 패턴, 파싱 불가 fallback, DTO 검증 한계까지 5줄 이상 담고 있다. 동일 레벨의 bullet 이지만 밀도 편차가 커서 문서를 스캔할 때 "window 파싱 fallback" 만 별도 subsection 처럼 보인다.
- **제안**: "window 파싱 fallback" bullet 을 2줄로 압축(`parseIso8601Duration 자체 구현, 파싱 실패 시 PT1H fallback. DTO 검증 미비 → plan 대상`)하고, 상세 설명은 Rationale 의 `window_iso 를 ISO 8601 duration 으로 둔 이유` 섹션(이미 업데이트됨)에만 둔다.

---

## 요약

이번 변경은 `spec/data-flow/` 문서 14개를 구현 코드 기준으로 정합화한 대규모 spec 동기화 작업이다. 전반적으로 구현 갭을 명시적으로 문서화하고 라인 번호 대신 함수명을 참조하는 방향으로 개선된 점은 긍정적이다. 유지보수성 관점의 주요 패턴 문제는 두 가지다. 첫째, 동일한 사실(attribution 갭, 구현 갭 인과 흐름)이 §1.x 본문과 Rationale 양쪽에 반복 기재되어 향후 사실이 바뀌면 두 곳을 모두 수정해야 하는 이중 진실 위험이 존재한다(10-triggers §1.4, 7-llm-usage §1.3, 15-external-interaction §1.5). 둘째, 새로 추가된 신규 파일(13, 14, 15)의 코드 진입점 설명과 bullet 밀도가 기존 파일들의 간결한 패턴과 달라 스타일 일관성이 저하되었다. 코드 오류 수준의 구조적 문제는 발견되지 않았으며, 발견된 사항은 모두 가독성·중복 제거 범주의 INFO/WARNING 등급이다.

## 위험도

LOW

STATUS: SUCCESS
