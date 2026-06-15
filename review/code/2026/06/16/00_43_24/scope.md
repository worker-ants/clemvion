# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: `auth-config-ip-whitelist.dto.spec.ts` (신규)
- **[INFO]** 신규 테스트 파일이며 `@IsIpOrCidr` 검증기·DTO 통합 검증이 작업 의도(IP 형식 검증 추가)에 직결된다.
  - 위치: 파일 전체
  - 상세: `isIpOrCidr` 함수, `IsIpOrCidrConstraint.defaultMessage`, `CreateAuthConfigDto`, `UpdateAuthConfigDto` 세 describe 블록이 모두 신규 추가된 검증 로직을 정확히 커버하고 있다. 범위를 벗어난 내용 없음.

---

### 파일 2: `create-auth-config.dto.ts`
- **[INFO]** `@IsIpOrCidr({ each: true })` 데코레이터 1개 추가 + `import` 1줄 추가.
  - 위치: diff 2건 (import, 데코레이터)
  - 상세: 범위 내 최소 변경. 기존 필드나 다른 검증기 손대지 않음.

---

### 파일 3: `is-ip-or-cidr.validator.ts` (신규)
- **[INFO]** IP/CIDR 검증 전용 파일 신규 생성. `isIpOrCidr` 함수·`IsIpOrCidrConstraint`·`IsIpOrCidr` 데코레이터 세 요소가 단일 책임으로 구성되어 있음.
  - 상세: `@IsIP`가 CIDR을 거부하는 이유로 커스텀 검증기를 만든 배경이 JSDoc에 명시되어 있고, `AuthConfigsService.parseIp`와 동일한 수용 기준을 사용한다는 설명도 있다. 범위 이탈 없음.

---

### 파일 4: `update-auth-config.dto.ts`
- **[INFO]** `@IsIpOrCidr({ each: true })` 데코레이터 1개 + `import` 1줄 추가.
- **[INFO]** `ApiPropertyOptional`의 `example` 필드 추가 (`['10.0.0.0/8', '203.0.113.42']`).
  - 위치: diff `+    example: ['10.0.0.0/8', '203.0.113.42'],`
  - 상세: Swagger 문서용 `example` 추가는 기능 검증 대상은 아니나, `CreateAuthConfigDto`에 동일 example이 이미 존재하고 `UpdateAuthConfigDto`에만 빠져 있던 것을 함께 채운 수준이다. 실질적 범위 이탈로 보기 어려우나 엄밀히는 요청 범위 외 문서 추가다. 해가 없고 일관성을 높이는 변경이므로 WARNING 수준 이하로 평가.

---

### 파일 5: `generated-key-autoclear.test.tsx` (신규)
- **[INFO]** `generatedKey` 30초 자동클리어(create/regenerate)와 `revealedSecret` 30초 자동클리어(reveal)에 대한 테스트 신규 생성. `page.tsx`에 추가된 `useEffect` 자동클리어 로직과 1:1 대응한다.
  - 상세: 범위를 벗어난 내용 없음. `AUTOCLEAR_MS = 30_000` 상수를 `page.tsx`의 `SECRET_AUTOCLEAR_MS`와 동기화하는 주석도 의도에 맞다.

---

### 파일 6: `page.tsx`
- **[INFO]** `useEffect` import 추가 + `SECRET_AUTOCLEAR_MS` 상수 추가 + `generatedKey`/`revealedSecret` 두 useEffect 블록 추가.
- **[INFO]** 기존 `revealMutation.onSuccess` 내부의 인라인 `window.setTimeout` 제거 + 주석 교체.
  - 위치: diff `-      // 30초 후 자동 hide ...` / `+      // 30초 자동 hide 는 revealedSecret useEffect 가 처리 ...`
  - 상세: 인라인 타이머를 useEffect cleanup 패턴으로 리팩토링한 것은 기능적으로 등가이며 "generatedKey 자동클리어" 신규 기능과 함께 단일 정책(30초 자동클리어)으로 통일하는 연관 변경이다. 변경 의도와 완전히 일치하며 범위 이탈 없음.
  - 상세: 나머지 컴포넌트(테이블, 사이드 드로어, 뮤테이션 등)는 일절 변경 없음.

---

### 파일 7: `spec/1-data-model.md`
- **[INFO]** `ip_whitelist` 컬럼 설명에 "저장(create/update) 시 형식 검증 → 400 거부" 문구 추가.
  - 위치: `§2.17` 테이블 ip_whitelist 행
  - 상세: DTO 레이어에서 추가된 `@IsIpOrCidr` 검증을 spec에 반영한 동기화 업데이트다. 최소 단위 인라인 추가이며 범위 이탈 없음.

---

### 파일 8: `spec/2-navigation/6-config.md`
- **[INFO]** Reveal 섹션 뒤에 "create/regenerate 1회 노출도 30초 자동 hide 동일 정책" 안내 blockquote 2줄 추가.
  - 위치: `§A.4` Reveal 절차 블록 직후
  - 상세: `page.tsx`에 새로 추가된 `generatedKey` 자동클리어 정책을 spec에 문서화한 것이다. 범위 이탈 없음.

---

## 요약

8개 파일 변경 전체가 두 가지 작업 — (1) `ip_whitelist` DTO 레이어 IP/CIDR 형식 검증 추가(백엔드), (2) 평문 비밀값(generatedKey·revealedSecret) 30초 자동클리어 useEffect 패턴 도입(프론트엔드) — 에 직결된다. `update-auth-config.dto.ts`의 Swagger `example` 추가는 요청 범위를 엄밀히 따지면 부가 변경이나 일관성 보완 수준이며 해가 없다. 기존 코드의 불필요한 리팩토링, 관련 없는 파일 수정, 과도한 기능 확장, 의미 없는 포맷팅 변경은 발견되지 않았다. 모든 spec 파일 업데이트도 구현 변경의 직접적인 문서화다.

## 위험도

NONE
