---
id: "CLE-PLAT"
title: "플랫폼 구조"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "f40512ad7e90ddae8a637cef7dc744bcdd3c127337975677b7ef29dcf0394d53"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "440f17ffd5956f75ba689ec0c5dd25649364f5c72abde91cc59657609367a64f"
etag: "sha256-d241e71a3b90dcbbafbe0ef620cee5fbc3b2e053098e5c73ab97b639aa7adcb8"
---
> 구현 상태: 부분 구현 · 원문: 없음(영역 문서) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

플랫폼 구조 영역은 특정 기능 하나에 속하지 않고 여러 영역이 함께 기대는 기반을 다룬다. 서버와 클라이언트의 컴포넌트 구성, 제품 전체가 지켜야 하는 품질 목표, 데이터베이스의 엔티티 관계와 인덱스, BullMQ 큐와 Redis 키, 파일 저장소가 여기에 속한다.

이 영역이 받치는 기술 목표는 [Clemvion 제품 개요](../CLE-VISION.md) 의 목표 표에 있다. 확장 가능한 노드 시스템, 안정적인 워크플로우 실행 엔진, 실시간 디버깅이다. 실행 엔진의 내부 동작은 [실행](../CLE-EXEC/CLE-EXEC.md) 영역이, 스키마 변경 절차와 Redis 키 명명 같은 개발 규약은 [개발 규약](../CLE-ENG/CLE-ENG.md) 영역이 다룬다.

## 문서

| 문서 | 다루는 것 |
| --- | --- |
| [시스템 아키텍처](CLE-PLAT-ARCH.md) | 컴포넌트 구성, 데이터 계층, 시스템 수준 데이터 흐름과 영역별 데이터 문서 구성, 다중 인스턴스·동시성 모델, SaaS 와 셀프 호스팅의 배포 환경 차이 |
| [비기능 요구사항](CLE-PLAT-NFR.md) | 성능·보안·확장성·가용성·관측성·국제화와 접근성·배포와 운영 요구사항(`NF-*`) |
| [데이터 모델 개요](CLE-PLAT-DATA.md) | 엔티티 관계 지도와 엔티티별 소유 문서, 공통 컬럼 규칙, FK 삭제 동작, 인덱스 전략 |
| [비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE.md) | BullMQ 큐 18개의 목록과 옵션, DLQ 모니터링, Redis 키와 pub/sub 채널 목록의 단일 기준 |
| [파일 저장소](CLE-PLAT-STORAGE.md) | S3 호환 파일 저장소의 구성, 키 규칙, 지식 저장소 원본 문서와 아바타의 흐름, 삭제 수명주기 |
