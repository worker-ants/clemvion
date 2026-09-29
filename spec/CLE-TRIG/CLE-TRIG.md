---
id: "CLE-TRIG"
title: "트리거"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "2475df06462396c57ec0c99dcd556158810c1fbc256636c4385809b0d7a378d6"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "d8fb9830c6b6f287a84ff20b8af8738156348b34a9587001c0ab86faa27b330e"
etag: "sha256-60367b66113a5731ad5d4ca8466e56528590b833905dc663029e56f22b3b3c2d"
---
> 구현 상태: 부분 구현 · 원문: 없음(영역 문서) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

트리거 영역은 워크플로우를 시작시키는 진입점을 다룬다. 트리거(Trigger, `trigger`)의 유형은 웹훅·스케줄·수동 세 가지다. 채팅 채널과 웹채팅은 새 유형이 아니라 웹훅 트리거의 설정 변형이다.

세 진입점은 모두 실행 엔진의 `execute()` 로 모인다. 웹훅은 외부 HTTP 요청으로, 스케줄은 Cron 표현식에 따라 BullMQ 가 발사해서, 수동은 사용자가 화면이나 API 로 바로 실행해서 워크플로우를 시작한다. 외부 호출자가 웹훅을 부를 때 쓰는 인증 설정(AuthConfig)도 이 영역에 속한다.

이 영역이 다루지 않는 것은 다음과 같다.

- 워크플로우 안의 진입 노드(수동 트리거 노드)와 트리거 파라미터 계약: [트리거 노드](../CLE-NODE-TRIG/CLE-NODE-TRIG.md)
- 실행이 시작된 뒤의 처리: [실행](../CLE-EXEC/CLE-EXEC.md)
- 실행 중인 워크플로우와 외부가 주고받는 표면, 채팅 채널, 웹채팅: [외부 상호작용](../CLE-IX/CLE-IX.md)
- 외부 서비스로 나가는 연결(통합)의 자격 증명: [통합](../CLE-INT/CLE-INT.md)

## 문서

| 문서 | 다루는 것 |
|------|----------|
| [트리거 관리](CLE-TRIG-MANAGE.md) | 트리거 화면(목록·필터·상세 패널·생성), 트리거 API, PATCH 계약, `config` 동시 쓰기 직렬화, 삭제 권한·확인·연쇄 영향·자원 정리 정책 |
| [스케줄](CLE-TRIG-SCHEDULE.md) | 스케줄 화면, Cron 표현식과 시각 편집 변환, 시간대, 스케줄 API, 스케줄 실행의 실행 출처 기록 |
| [웹훅](CLE-TRIG-WEBHOOK.md) | 웹훅 수신 엔드포인트와 URL 형식, 엔드포인트 경로의 비밀성, 인증 검증, 워크플로우 입력 구조, 공개 웹훅 남용 방어, 수신 처리 흐름 |
| [외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md) | 인증 설정 화면, 인증 방식별 입력 항목, 사용 내역, 필드 마스킹과 평문 보기, 권한, 인증 설정 API |
| [트리거 데이터와 흐름](CLE-TRIG-DATA.md) | Trigger·WebhookEndpointReservation·Schedule·AuthConfig 엔티티, 세 진입 흐름, 트리거와 스케줄 동기화, 삭제 때 자원 해제 순서, 저장소 매핑과 상태 전이 |

## 영역의 미결 사항

영역 문서들에 흩어진 결정 필요 항목 가운데 여러 문서에 걸치는 것은 다음 두 가지다.

- 워크플로우를 비활성화하면 웹훅·스케줄 트리거 발사가 멈추는지: [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 의 미결 사항
- 스케줄 시간대를 지정하지 않았을 때의 기본값: [스케줄](CLE-TRIG-SCHEDULE.md) 의 미결 사항
