---
id: "CLE-AI"
title: "AI 모델과 메모리"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "48e92f93f7339520a85c9f4a2d072c31e0e03c697710f1ab82a09469ddf56d18"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "13d0f89565f7353f17f834831a1c6558fa9a534a4b4b2c8a3f6c506e802f8e6e"
etag: "sha256-9a490140c9ab8785c9c63569fd4cf4055128ad7ba6e7ccadd6fbd9682d75f7c6"
---
> 구현 상태: 구현됨 · 원문: 없음(영역 문서) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 Clemvion 이 AI 모델을 부르고 그 결과를 기억하는 기반을 다룬다. AI 노드·지식 저장소·워크플로우 AI 어시스턴트는 모두 여기서 정한 계층으로 모델을 부른다.

- **LLM 클라이언트**: 여러 모델 프로바이더(OpenAI, Anthropic, Google AI, Azure OpenAI, Local)를 한 인터페이스로 부른다. 리랭커(`tei`, `cohere`)는 별도 인터페이스와 팩토리로 나눈다.
- **모델 설정**: 워크스페이스가 Chat·Embedding·Rerank 모델 연결을 한 화면에서 등록하고, AI 노드와 지식 저장소가 그 설정을 참조한다.
- **LLM 사용량 기록**: Chat 계열 호출의 토큰과 비용을 쌓아 통계와 알림 규칙의 기준으로 삼는다.
- **에이전트 메모리**: 메모리 전략이 `persistent` 인 AI 노드가 실행을 넘어 사실·선호를 저장하고 회수한다.

AI 노드 자체의 설정과 실행은 [AI 노드](../CLE-NODE-AI/CLE-NODE-AI.md), 지식 저장소의 임베딩과 검색은 [지식 저장소](../CLE-KB/CLE-KB.md) 영역에서 정한다.

## 문서

- [LLM 클라이언트](CLE-AI-LLM.md): 인터페이스, 클라이언트 팩토리, 프로바이더별 API 매핑, 모델 목록 미리보기, SSRF 가드, 에러 매핑, API 키 보안, LLM 스텁 모드, 스트리밍, `LlmService` 호출 계약.
- [모델 설정](CLE-AI-MODELS.md): Chat·Embedding·Rerank 탭 화면, 기본 모델 선택, 연결 테스트와 차원 자동 저장, 권한, `/api/model-configs` API.
- [LLM 사용량 기록](CLE-AI-USAGE.md): 모델 설정·LLM 사용량 엔티티, 사용량 적재 흐름과 호출하는 쪽 목록, 사용량 귀속, 비용 계산.
- [에이전트 메모리](CLE-AI-MEMORY.md): 저장소와 메모리 범위 키, 메모리 추출·회수, 중복 갱신과 메모리 정리, 격리, 관리 API 와 관리 화면.
