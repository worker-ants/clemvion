# Security Review

## 발견사항

### INFO: 삭제된 bespoke 폼에서 prototype pollution 방어 어휘 참조 제거

- **위치**: `ai-configs.tsx` (삭제), `override-registry.ts` (수정)
- **상세**: 삭제된 `ai-configs.tsx` 의 `updateCategory` / `updateField` 함수는 동적 키(`key: string`)로 객체를 갱신하는 패턴(`{ ...c, [key]: val }`)을 사용했다. 전달 가능한 키가 `"name"`, `"description"`, `"type"`, `"required"` 로 제한된 `<select>` / `<Input>` 바인딩이었기 때문에 실질적 prototype pollution 위험은 낮았으나, 이제 해당 코드가 제거됐으므로 해당 경로 자체가 소멸했다. 신규 auto-form 경로는 backend zod schema 가 키 공간을 정의하며, spec §2.6.1 에서 `clearFields` 예약 키(`__proto__` 등) 제거가 명시되어 있다(`clearFields` 키 목록의 prototype pollution 방지 주석 확인). 직접적인 취약점은 아니며 기존 방어 설계가 유지된다.
- **제안**: 신규 auto-form(`clearFields` 핸들러)의 예약 키 필터 구현 여부를 별도 코드 리뷰에서 확인 권장. 본 변경 범위 내에는 문제 없음.

---

## 요약

이번 변경은 frontend UI 레이어에서 두 AI 노드(`text_classifier`, `information_extractor`)의 bespoke 설정 폼을 삭제하고 schema-driven auto-form 으로 전환하는 리팩터링이다. 변경된 파일은 문서(CHANGELOG·spec·plan) 3종, 프론트엔드 컴포넌트 삭제 1종, 레지스트리 수정 1종, 테스트 추가 1종이며 백엔드 변경은 0건이다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 우회, 안전하지 않은 암호화, 에러 정보 노출, 의존성 추가 등 실질적인 보안 위협 요소가 존재하지 않는다. 삭제된 컴포넌트에서 사용하던 동적 키 업데이트 패턴(잠재적 prototype pollution 경로)이 소멸했으며, auto-form 경로의 prototype pollution 방어는 spec 에 이미 명시되어 있다.

## 위험도

NONE
