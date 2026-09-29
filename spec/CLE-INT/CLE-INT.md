---
id: "CLE-INT"
title: "통합"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "c6ccb0823f9dabad00505ee2876f28eb8f9e4e24c687b01d45fa72a65bf7cb3a"
read_as: "approved"
task: null
source_paths: ["spec/2-navigation/4-integration.md", "spec/4-nodes/4-integration/_product-overview.md"]
mirror_sha256: "234fc9e2a6ba8dd95909ad3cdd5e1fbd04305888a8ebf937b1d3549ffb550bed"
etag: "sha256-a3728d0bf4dde837e80db55df5360865610c6961744ebf7b9929475c17945fe8"
---
> 구현 상태: 부분 구현 · 원문: `spec/4-nodes/4-integration/_product-overview.md` (§1), `spec/2-navigation/4-integration.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

통합(Integration, `integration`) 영역은 워크플로우가 외부 서비스를 부르는 데 필요한 연결을 다룬다. 사용자는 외부 서비스의 자격 증명을 통합으로 워크스페이스에 한 번 저장하고 통합 노드와 AI 에이전트가 그 통합을 참조해 외부 API 를 부른다. 한 서비스에 계정이나 인스턴스별로 여러 통합을 둘 수 있고 공개 범위에 따라 개인이나 조직 전체가 쓴다.

지원 서비스는 HTTP/REST, Database, Email(SMTP), Webhook(밖으로 보내는 호출), Google, GitHub, MCP 서버, Cafe24, MakeShop 이다. Cafe24 와 MakeShop 은 같은 통합을 워크플로우 노드와 AI 에이전트의 MCP 도구 양쪽에서 쓴다.

이 영역이 보장하는 것:

- 자격 증명을 암호화해 저장하고 응답에서는 가린다.
- OAuth 토큰을 자동으로 갱신하고 갱신할 수 없는 만료와 오류는 상태·배지·인앱 알림으로 알린다.
- 쓰이고 있는 통합은 지우지 못하게 막고 통합마다 사용처와 최근 호출 기록을 보여 준다.
- 개인 통합은 통합 소유자만, 조직 통합의 변경은 관리자 이상만 다룬다.

통합을 노드 설정에서 어떻게 참조하고 노드가 어떻게 실행되는지는 [통합 노드](../CLE-NODE-INT/CLE-NODE-INT.md) 영역이 다룬다. 같은 제품 요구사항 문서에 함께 있던 지식 저장소와 마켓플레이스는 [지식 저장소](../CLE-KB/CLE-KB.md) 와 [마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md) 에 있다.

## 문서

- [통합 관리](CLE-INT-MANAGE.md): 통합 목록·추가·상세 화면, 사용처 추적과 삭제 차단, 권한, 연결 테스트, 관리 API 와 에러 코드, 노드 실행·에디터·감사 로그 연동.
- [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md): 서비스마다 자격 증명에 저장하는 필드, 인증 유형, 권한 범위 프리셋, 연결 테스트가 확인하는 것.
- [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md): 팝업 OAuth 와 설치 우선 흐름(Cafe24 Private·MakeShop), App URL 과 콜백, 통합 재인증과 추가 권한 요청, 토큰 자동 갱신과 갱신 큐.
- [통합 상태와 만료 알림](CLE-INT-STATUS.md): 통합 상태와 상태 사유, 상태 전이, 주의 필요 판정과 상태 표시, 만료 스캐너, 만료 알림과 조치 필요 알림.
- [시크릿 저장소](CLE-INT-SECRET.md): `secret://` 참조, `SecretResolver` 호출 규약, 저장소 예외 필드, 암호화 저장 백엔드와 마스터키.
- [통합 데이터와 흐름](CLE-INT-DATA.md): 통합·활동 로그·OAuth 임시 테이블·시크릿 저장소 엔티티, 인덱스, 암호화, 생성·연결·설치·노드 실행 데이터 흐름.
- [MCP 클라이언트](CLE-INT-MCP.md): 외부 MCP 서버와 내부 MCP 브리지 도구를 LLM 도구로 노출하는 클라이언트 계층.
- [Cafe24](CLE-C24): Cafe24 연동 규약(operation 메타데이터, 별도 승인 scope)과 Admin API 카탈로그.
- [MakeShop](CLE-MKS): MakeShop 연동 규약(operation 메타데이터)과 Shop API 카탈로그.
