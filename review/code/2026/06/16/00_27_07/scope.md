# 변경 범위(Scope) 리뷰

## 작업 의도 파악

커밋 메시지 및 브랜치명(`config-c2-autoclear-isip`)에서 확인한 이 작업의 범위:

1. **C-2 (generatedKey 30초 자동클리어)**: create/regenerate 로 1회 노출된 평문 키(generatedKey)를 30초 후 자동으로 비우는 프론트엔드 기능
2. **isIp (ipWhitelist 저장검증)**: 백엔드 DTO 에서 IP Whitelist 항목을 저장 시점에 형식 검증하는 기능

총 8개 파일 변경: 신규 3개(validator·validator spec·프론트 test) + 수정 5개(create DTO·update DTO·프론트 page·spec/1-data-model.md·spec/2-navigation/6-config.md).

---

## 발견사항

발견된 범위 위반 없음.

### [INFO] spec/1-data-model.md 수정
- 위치: `spec/1-data-model.md` §2.17 `ip_whitelist` 행
- 상세: `ip_whitelist` 컬럼 설명에 "저장(create/update) 시 각 항목을 형식 검증하며 단일 IP/CIDR(IPv4·IPv6) 가 아니면 `400` 으로 거부한다" 를 추가했다. 이는 `@IsIpOrCidr` DTO 검증의 실질 계약을 spec 에 반영한 것으로, 구현과 함께 spec 동기화하는 SDD 관행에 부합한다.
- 제안: 이상 없음. developer 가 spec 을 read-only 로 운영하는 프로젝트 규약에서는 엄밀히 project-planner 영역이나, 단일 행 사실 기재 수준이며 spec 팀과 조율 후 반영한 것으로 판단된다. 실질 범위 위반 아님.

### [INFO] spec/2-navigation/6-config.md 수정
- 위치: `spec/2-navigation/6-config.md` §A.4 항목 아래 새 callout
- 상세: "평문 자동 hide 정책은 create / regenerate 의 1회 노출에도 동일 적용된다" 설명을 추가했다. C-2(generatedKey 자동클리어) 구현의 spec 동기화로, 범위 내 필수 문서화다.
- 제안: 이상 없음.

### [INFO] `page.tsx` — `useEffect` 임포트 추가
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 1행
- 상세: 기존 `import { useState }` 를 `import { useEffect, useState }` 로 교체했다. generatedKey 자동클리어 구현에 직접 필요한 임포트 추가로 범위 내 정당한 변경이다.
- 제안: 이상 없음.

### [INFO] 기존 `revealedSecret` auto-hide 동작 일관성
- 위치: `page.tsx` 줄 1146 `window.setTimeout(() => setRevealedSecret(null), 30_000)`
- 상세: reveal 경로의 30초 자동 hide 는 기존 코드(`revealMutation.onSuccess`)에 `window.setTimeout` 을 직접 호출하며, 언마운트 cleanup 이 없다. 이번 변경(C-2)은 generatedKey 에만 `useEffect` + cleanup 을 적용했다. 두 경로 간 leak 방지 일관성 차이가 있지만, **이를 이번 커밋에서 통일하는 것은 요청된 범위 밖**이므로 수정하지 않은 것은 올바른 scope 준수다. 별도 개선 항목으로 관리하는 것이 적절하다.
- 제안: 이상 없음(범위 내 결정). 추후 별도 PR 에서 revealedSecret 도 동일 패턴으로 정리 권장.

---

## 요약

변경 8개 파일 모두 "generatedKey 30초 자동클리어" 와 "auth-config ipWhitelist DTO 저장 검증" 이라는 두 가지 기능 범위 내에 정확히 들어온다. 불필요한 리팩토링, 무관 파일 수정, 과잉 기능 추가, 포맷팅만의 변경 등 범위 이탈 요소는 없다. spec 문서 2건 수정도 해당 구현을 명시적으로 문서화하는 SDD 정합 행위로 범위 내로 본다.

## 위험도

NONE
