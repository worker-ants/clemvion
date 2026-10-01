---
id: "CLE-NODE-INT"
title: "통합 노드"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-NODE"
ancestors: ["CLE-VISION", "CLE-NODE"]
area: "CLE-NODE"
content_hash: "7eb2b217e1a968da7da9c5813647e3f4b379341b59acebe723cf6126b5436756"
read_as: "approved"
task: null
source_paths: ["spec/4-nodes/4-integration/0-common.md", "spec/4-nodes/_product-overview.md"]
mirror_sha256: "e4bd380b4931dd1fc3cd59b6b41148e9c652e3dc3040e193d9d0661f2c03b772"
etag: "sha256-40761ba2271dc8b4df967c1fcb747b19b7378da8c3caf16d90877fb8159c7a2c"
---
> 구현 상태: 구현됨 · 원문: `spec/4-nodes/_product-overview.md` (§7 머리말), `spec/4-nodes/4-integration/0-common.md` (문서 목록) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

통합 노드(integration nodes)는 통합(Integration)에 저장된 자격 증명을 써서 외부 서비스와 데이터를 주고받는 노드다. 범용 노드(HTTP Request, Database Query)와 서비스 특화 노드(Send Email, Cafe24, MakeShop)로 이뤄지며 모두 다섯 종류다. 노드 유형 id·아이콘·주요 설정은 [노드 시스템 구조와 카탈로그 §통합 (5종)](../CLE-NODE/CLE-NODE-ARCH.md#통합-5종) 카탈로그 표에 있다. 서비스 특화 노드는 언제나 통합을 참조하고, HTTP Request 노드는 인증 방식을 `integration` 으로 골랐을 때만 참조한다.

이 영역은 노드의 설정·실행·출력·에러를 다룬다. 통합 자체의 등록·인증·상태 관리는 [통합](../CLE-INT/CLE-INT.md) 영역이, Cafe24·MakeShop API 카탈로그와 메타데이터 형식은 [Cafe24](CLE-C24)·[MakeShop](CLE-MKS) 영역이 다룬다. 외부 MCP 서버 통합은 노드가 아니라 [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md)의 도구로만 쓰인다.

## 문서

- [통합 노드 공통](CLE-NODE-INT-COMMON.md): 통합 참조와 통합 선택기, 핸들러 6단계 계약(실행 엔진이 통합 핸들러를 부르는 순서 포함), 공통 에러 코드와 에러 포트 라우팅(D4), 사설망 차단, 캔버스 요약과 삭제된 통합 표시.
- [HTTP Request 노드](CLE-NODE-HTTP.md): 임의 URL 로 HTTP 요청을 보내는 범용 노드. 인증 방식 세 가지, 리다이렉트 직접 추적, 응답 헤더·URL 자격 증명 가림.
- [Database Query 노드](CLE-NODE-DBQUERY.md): PostgreSQL·MySQL 에 SQL 을 실행하는 범용 노드. 파라미터 바인딩, 연결 풀 캐시와 무효화, 진행 중 쿼리 취소, 드라이버 에러 분류.
- [Send Email 노드](CLE-NODE-EMAIL.md): SMTP 로 이메일을 보내는 노드. 배열 수신자, 첨부 파일 보안, 에러 코드 흡수 규칙.
- [Cafe24 노드](CLE-NODE-CAFE24.md): Cafe24 Admin API operation 을 메타데이터 기반 동적 폼으로 부르는 노드. 호출 제한, 401 재시도, AI 에이전트 내부 MCP 브리지 노출, Private 앱 설치 엔드포인트 보안.
- [MakeShop 노드](CLE-NODE-MAKESHOP.md): MakeShop Shop API operation 을 부르는 노드. Cafe24 노드와 같은 모양에 MakeShop 고유 분기(호스트 하나 + `shop_uid`, 평평한 본문, 별도 승인 없음).
