---
id: "CLE-RESEARCH"
title: "리서치"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "3b1b825a136cb43b6608087da903ae884dcb1d63fb42adb3c446fe2974491f83"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "52b9bfbc47bca5ed4afda3d29f3731db44c0c82f536a65b68d92ad1e65c43ab7"
etag: "sha256-3c800a1845ac0d6bd9b1a7385713414511f9fd043e816d136fc76bfb2a7c1db5"
---
> 성격: 리서치 영역 · 원문: 저장소 `plan/research/` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 경쟁 분석과 기술 조사처럼 제품 결정에 참고하는 조사 문서를 모은다. 여기 문서는 요구사항을 정하지 않는다. 기능 규칙과 구현 상태의 기준은 각 영역 문서다. 리서치에서 나온 판단이 제품 결정이 되면 그 결정은 해당 영역 문서의 본문과 Rationale 에 적는다.

리서치 문서의 판단과 수치는 작성 시점 기준이다. 그래서 문서마다 머리 줄에 작성일과 교정일을 적는다. 그 뒤 구현되거나 바뀐 항목은 본문에 현재 상태를 표시하고 기준 문서로 링크한다. 오래된 판단을 근거로 우선순위를 정하지 않도록 하기 위해서다.

리서치에서 나온 후속 항목 가운데 다른 추적처가 없는 것은 리서치 문서 안에 따로 모아 둔다. 제품 비전과 로드맵의 기준은 [Clemvion 제품 개요](../CLE-VISION.md) 다.

## 문서

- [경쟁 분석: n8n · Flowise](CLE-RESEARCH-COMPETITORS.md): Clemvion 을 n8n · Flowise · Dify · Langflow · Make · Zapier · Gumloop/Lindy 일곱 종과 비교한 전략 리서치(2026-06-03 작성, 2026-07-16 교정). 포지셔닝과 두 해자, 강점과 약점, 실행 엔진 신뢰성 분석, 한국 채널 전략, 경쟁사별 비교, 우선순위별 후속 액션과 그 현재 상태를 다룬다.

## Rationale

### 리서치를 작업 계획과 따로 둔다

리서치 문서는 끝나는 작업이 아니다. 두고 참조하는 문서다. 진행 중 작업은 처리할 항목이 남은 작업이고 완료 작업은 모든 항목이 끝난 작업이다. 리서치는 어느 쪽에도 맞지 않는다. 경쟁 분석도 스스로를 전략 리서치 산출물로 규정했다. 그 후속 액션 목록은 다른 계획으로 넘기는 위임 목록이었다. 그러면서도 아직 착지하지 않은 전략 항목이 살아 있어 완료로 볼 수도 없었다. 그래서 저장소에서는 2026-07-16 에 `plan/research/` 로 옮겼다(사용자 결정). NERV 에서도 별도 영역으로 둔다.
