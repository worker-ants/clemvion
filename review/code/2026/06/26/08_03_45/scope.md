# 변경 범위(Scope) 리뷰

## 발견사항

이 PR 의 변경은 단일 파일(`integration-oauth.service.ts`)에만 국한되며, 커밋 메시지가 명시한 M-1 리팩토링 범위(install 흐름 공통 보일러플레이트 4종 helper 추출)와 실제 diff 내용이 일치한다.

점검 항목별 검토 결과:

- **[INFO]** 의도 이상의 변경 없음  
  위치: 파일 전체  
  상세: 4개의 private helper(`assertInstallTimestampFresh`, `assertInstallNonceNotReplayed`, `buildIntegrationDetailRedirectUrl`, `persistReauthorizeState`)만 추출되었으며, 그 외 다른 메서드나 클래스 수준 변경은 없다.

- **[INFO]** 불필요한 리팩토링 없음  
  위치: diff 전체  
  상세: HMAC 검증, 에러코드 prefix, HMAC 실패 로깅, cafe24 install_token recovery, makeshop SSRF·dedup·PKCE 등 provider-specific 분기는 의도적으로 각 caller 에 유지되었다. 커밋 메시지에도 이 결정이 명시되어 있어 의도된 경계 설정이 확인된다.

- **[INFO]** 기능 확장 없음  
  위치: 4개 helper 함수  
  상세: `assertInstallTimestampFresh`의 ±5min 윈도우 로직, `assertInstallNonceNotReplayed`의 nonce 체크 로직, `buildIntegrationDetailRedirectUrl`의 URL 조합 로직, `persistReauthorizeState`의 state row 생성 로직 모두 기존 인라인 코드를 그대로 추출한 것이다. 새로운 조건·파라미터·부작용이 추가되지 않았다.

- **[INFO]** 무관한 파일 수정 없음  
  위치: 변경 파일 목록  
  상세: 단일 파일(`integration-oauth.service.ts`)만 변경되었다.

- **[INFO]** 포맷팅 변경 없음  
  위치: diff  
  상세: 추출된 helper 삽입 외 불필요한 공백·줄바꿈 변경은 발견되지 않았다.

- **[INFO]** 주석 변경 적절  
  위치: 라인 64-82 (섹션 헤더 주석)  
  상세: 추출된 helper 영역에 섹션 헤더 주석이 추가되었으나, 이는 helper 의 범위·결정 근거·provider-specific 경계를 설명하는 필수 문서화다. 커밋 메시지가 명시한 "provider-specific 분기는 의도적으로 각 메서드에 유지" 결정의 근거를 코드 레벨에서 설명하므로 적절하다.

- **[INFO]** 임포트 변경 없음  
  위치: 파일 상단  
  상세: 새로운 임포트가 추가되지 않았고 기존 임포트도 변경되지 않았다. 4개 helper 가 클래스 내부 private 메서드이므로 외부 의존성이 필요 없었다.

- **[INFO]** 설정 파일 변경 없음  
  위치: 리포지토리 전체  
  상세: 단일 서비스 파일 외 설정 파일 변경 없음.

## 요약

이 변경은 커밋 메시지에 명시된 M-1 리팩토링 범위(behavior-preserving boilerplate extraction)를 정확히 이행한다. 4개의 private helper 추출은 `handleInstall`(cafe24)과 `handleMakeshopInstall` 양쪽에서 동일하게 반복되던 코드 블록을 제거하며, provider-specific 분기(HMAC 검증, 에러코드 prefix, PKCE 등)는 의도적으로 caller 에 잔류시킨 경계가 설계 문서와 코드 주석 양쪽에 명시되어 있다. 범위 이탈에 해당하는 항목이 없다.

## 위험도

NONE
