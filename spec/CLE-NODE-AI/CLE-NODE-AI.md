---
id: "CLE-NODE-AI"
title: "AI 노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "62502cd551d5f813f419fb5f16ac931c755444ab74d1755d50ee2e568465f9f9"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/3-ai/_product-overview.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "b2dce310daf486d1d8586149a1da9c9c519eb40d461acdcdc870aee38dfae8cf"
etag: "sha256-1c4841f7b48ac30ae4372a1300fac5914bf3256c6f5b8491de8fc9164b07df66"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/3-ai/_product-overview.md` (§1 목표, §2 범위), `spec/4-nodes/_product-overview.md` (§6) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

AI 노드 영역은 LLM 을 부르는 노드 세 종류를 다룬다. AI 에이전트 노드는 LLM 으로 응답을 만들고 지식 저장소·MCP·조건·표시 도구를 쓴다. 텍스트 분류기 노드는 입력을 카테고리로 나눠 포트로 보낸다. 정보 추출기 노드는 비정형 텍스트에서 구조화 필드를 뽑는다. AI 에이전트와 정보 추출기는 멀티턴으로 사용자와 대화할 수 있다.

LLM 클라이언트·모델 설정·사용량·에이전트 메모리는 [AI 모델과 메모리](../CLE-AI/CLE-AI.md), 지식 저장소는 [지식 저장소](../CLE-KB/CLE-KB.md), 에디터의 워크플로우 AI 어시스턴트는 [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) 영역이 다룬다.

## 문서

- [AI 노드 공통](CLE-NODE-AI-COMMON.md): 세 노드가 함께 따르는 모델 선택, 대화 맥락 설정, 메모리 전략, 시스템 컨텍스트 접두, 출력 형태와 에러 계약, 캔버스 요약, AI 영역 기술 결정과 비기능 기준
- [AI 에이전트 노드](CLE-NODE-AGENT.md): AI 에이전트의 설정·화면·포트·도구 분류·표시 도구·도구 정의 크기 예산·조건·실행 로직·LLM 호출 타임아웃·에러 코드
- [AI 에이전트 노드 출력과 디버그](CLE-NODE-AGENT-OUTPUT.md): AI 에이전트의 단일 턴·멀티턴 출력 구조, 표시물 페이로드 운반, LLM 호출 기록(`meta.turnDebug`)
- [텍스트 분류기 노드](CLE-NODE-CLASSIFIER.md): 단일·다중 레이블 분류, 카테고리 포트, 출력 구조와 에러 코드
- [정보 추출기 노드](CLE-NODE-EXTRACTOR.md): 출력 스키마 기반 추출, 단일 턴·멀티턴 수집 대화, 에이전트 메모리 회수·추출

## 영역 목표

워크플로우 엔진 위에 AI 기능을 더해 사용자가 LLM 기반 지능형 워크플로우를 만들게 한다.

| 구분 | 목표 |
|------|------|
| 사용자 가치 | 프롬프트만으로 텍스트 분류, 정보 추출, 질의응답 같은 AI 작업을 워크플로우에 넣는다 |
| 기술 목표 | 여러 LLM 프로바이더 지원([LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md)), RAG 파이프라인([RAG 검색](../CLE-KB/CLE-KB-SEARCH.md)), 도구 호출 기반 에이전트 실행 |
| 제품 차별화 | 지식 저장소와 AI 에이전트를 결합해 코딩 없이 AI 에이전트를 만든다 |

## 범위

원래 AI 제품 정의는 다음 영역을 함께 다뤘다. 이 영역은 AI 노드만 소유하고 나머지는 소유 문서로 넘긴다.

| 영역 | 상태 | 소유 문서 |
|------|------|-----------|
| 모델 설정(Chat·Embedding·Rerank), 다중 프로바이더(OpenAI, Anthropic, Google, Azure, Local) | ✅ | [모델 설정](../CLE-AI/CLE-AI-MODELS.md) |
| AI 노드 3종(AI 에이전트, 텍스트 분류기, 정보 추출기) | 부분 구현(노드별 요구사항 표시 참조) | 이 영역 |
| 지식 저장소(문서 업로드, 임베딩, RAG 검색) | ✅ | [지식 저장소](../CLE-KB/CLE-KB.md) |
| AI 에이전트의 지식 저장소 연결 | ✅ | [AI 에이전트 노드](CLE-NODE-AGENT.md) |
| 워크플로우 AI 어시스턴트 | ✅ | [워크플로우 AI 어시스턴트](../CLE-WF/CLE-WF-ASSIST.md) |

팀 워크스페이스, 권한, 2단계 인증, 추가 통합 노드는 원래 AI 제품 정의의 범위 밖이었다. 현재 제품 구현 현황은 [Clemvion 제품 개요](../CLE-VISION.md) 에 있다.

## Rationale

### 구현 상태 표기를 노드 요구사항별로 둔 이유

원래 AI 제품 정의는 머리말에 "3.1~3.6 의 AI 기능은 모두 구현 완료" 라고 적었다. 그러나 노드 제품 정의는 AI 에이전트 요구사항 일부(표시 도구, 메모리 전략 등)를 진행 중으로 표시했고, AI 에이전트 스펙도 부분 구현 상태였다. 그래서 전체를 한 줄로 단정하지 않고 각 노드 문서의 요구사항 줄에 구현 상태를 붙인다.

### 도구 영역을 범위와 목표에서 뺀 이유

원래 범위의 "AI 에이전트 고급: 도구 영역(Tool Area)을 통한 도구 호출" 과 목표의 "Knowledge Base + AI Agent + Tool Area 결합" 에 나온 도구 영역 입력 경로는 제거됐다. 제거 결정은 [AI 에이전트 노드](CLE-NODE-AGENT.md) 에 있다.
