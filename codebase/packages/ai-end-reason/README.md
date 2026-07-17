# @workflow/ai-end-reason

AI 노드(AI Agent · Information Extractor)가 생산하는 `output.result.endReason`
**값 도메인**의 단일 진실.

## 왜 있나

이 목록은 backend 가 선언하고 frontend 가 소비한다. 예전엔 frontend 가 손으로
베낀 사본을 들고 있었고, 그 사본이 backend 와 어긋날 때마다 **대화 미리보기 탭이
통째로 사라졌다** (`error`·`condition` 누락 — PR #959). 사본을 없애 drift 를
**구조적으로 불가능**하게 만든다.

## 무엇을 소유하나

| | |
|---|---|
| **소유** | endReason **값 도메인** (`AiAgentEndReason` / `InformationExtractorEndReason` / 파생 `ConversationEndReason` + 런타임 배열) |
| **소유하지 않음** | 값의 **의미·port 매핑** → `spec/4-nodes/3-ai/{1-ai-agent,3-information-extractor}.md` · 출력 **봉투 구조** → `spec/conventions/node-output.md` |

## 왜 두 유니온이 다른가

의도적이다. IE 는 `condition` 라우팅이 없고 대신 `completed`·`max_retries` 를
갖는다. 합치면 각 노드의 종결 의미가 흐려지므로 **파생 유니온**만 만든다.

## 값 추가 시

각 노드 유니온에 추가하면 `CONVERSATION_END_REASONS` 의 exhaustiveness 검사가
**컴파일 타임에** 배열 갱신을 강제한다. 배열만 고치면 `satisfies` 가 막는다.
