### 발견사항

해당 없음

### 요약

이번 변경은 WebSocket 프로토콜의 메시지 source 마커(`'live'`/`'injected'`) 백필 로직 추가(execution-engine), OAuth 컨트롤러 테스트의 타입 캐스팅 수정, LLM 클라이언트 인터페이스에 transport-layer 전용 `source?` 필드 추가로 구성된다. 4개 파일 모두 순수 애플리케이션 레이어 또는 테스트 코드이며, DB 쿼리·ORM·마이그레이션·스키마·커넥션 관리와 관련된 코드 변경이 전혀 없다. 데이터베이스 관점에서 점검할 사항이 없다.

### 위험도

NONE
