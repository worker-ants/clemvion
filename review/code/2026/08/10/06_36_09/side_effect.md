# 부작용(Side Effect) 리뷰 — auth-guard-reflection-hardening 후속 (workspace-id-fixtures 유일성 가드 + nil-UUID SoT 정리)

## 발견사항

- **[INFO]** 모듈 최상위(top-level) 코드에 `throw` 가능 문장을 추가 — import 시점 부작용
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:88` (`assertAllUnique(ALL_WS);`)
  - 상세: 종전에는 이 모듈이 `const` export 선언만 있는 순수 데이터 모듈이었다. 이번 변경으로 모듈 평가(evaluation) 시점에 `assertAllUnique(ALL_WS)` 가 실행되며, `ALL_WS` 7개 값 중 중복이 생기면 **import 하는 즉시 throw** 한다. Node/Jest 의 모듈 캐싱 특성상 이 검사는 프로세스당 1회만 실행되지만, throw 가 발생하면 이 모듈을 import 하는 모든 소비 스위트(`workspace.decorator.spec.ts` · `roles.guard.spec.ts` · `workspace-context.util.spec.ts`, 그리고 신설된 `workspace-id-fixtures.spec.ts` 자신)가 개별 실패가 아니라 **"Test suite failed to run"** 형태로 동시에 실패한다. 이는 의도된 설계이고(docstring·Error 메시지에 명시), 파일이 `common/__test-utils__/`(테스트 전용, 런타임 미배포)로 스코프가 좁아 프로덕션 부작용은 없다. 다만 "여러 무관한 스위트가 한 모듈의 로드 실패로 동시에 붉어진다"는 결합(coupling)은 디버깅 시 원인 파악을 어렵게 할 수 있어 기록해 둔다.
  - 제안: 현재 수준(Error 메시지가 원인·영향 범위를 명시)이면 충분하다. 추가 조치는 불요.

- **[INFO]** 신설 스펙이 테스트 시점에 형제 소스 파일을 문자열로 읽어 정규식 매칭 — 소스 텍스트 형식에 결합
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:38-47` (`readFileSync(join(__dirname, 'workspace-id-fixtures.ts'), 'utf8')` 후 `/^\s*assertAllUnique\(ALL_WS\);/` 매칭)
  - 상세: 이 파일 읽기는 리포지토리 내부의 읽기 전용(read-only) 동기 `fs` 호출로, 새 파일 생성·수정·삭제가 아니라 부작용 관점에서는 안전하다. 다만 "로드 시점에 실제로 호출되는가"를 소스 텍스트 정규식으로 검증하는 방식이라, `workspace-id-fixtures.ts` 쪽에서 호출 줄 앞에 인라인 주석을 붙이거나 줄바꿈 스타일이 바뀌면(세미콜론 생략 등) 이 테스트가 실패할 수 있다. 부작용이라기보다 결합도/유지보수성 이슈이며, 이미 주석으로 "배선 검증이라 이 형태가 맞다"는 의도가 명시돼 있어 설계상 트레이드오프로 판단된다.
  - 제안: 변경 불요. 향후 `workspace-id-fixtures.ts` 의 호출부 스타일을 바꿀 때 이 spec 도 함께 갱신해야 함을 인지하는 정도로 충분.

- **[INFO]** 공용 테스트 유틸 모듈에 신규 public export 2개 추가 — 순수 추가(additive)라 기존 소비자 영향 없음
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:63-71`(`ALL_WS`), `:78-86`(`assertAllUnique`)
  - 상세: 기존 export(`HEADER_WS`~`NIL_WS`)의 이름·값은 변경되지 않았다(diff 범위 밖). 시그니처 변경도 없다. 순수 추가이므로 기존 3개 소비 스위트의 호출부에는 영향이 없다.
  - 제안: 없음.

## 검토했으나 부작용 소견 없음

- `codebase/backend/src/common/utils/uuid.spec.ts` — docstring/주석 텍스트만 재배치(내용은 다른 파일로 SoT 이관), 테스트 로직(assertion)·import·시그니처 변경 없음.
- `plan/in-progress/auth-guard-reflection-hardening.md` — 순수 plan 문서 갱신(체크박스 상태·문단 정리), 코드/런타임 부작용 없음.
- 전역 변수 신규 도입, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경 사례는 4개 파일 전체에서 발견되지 않음.

## 요약

이번 변경의 핵심 부작용은 `workspace-id-fixtures.ts` 모듈 최상위에 `assertAllUnique(ALL_WS)` 호출을 추가해 **import 시점에 throw 할 수 있는 런타임 검사**를 도입한 것이다. 이는 테스트 전용 모듈(`__test-utils__`, 프로덕션 런타임 미배포) 범위 안에서 의도적으로 설계된 fail-fast 가드이며, throw 시 영향 범위(3개 소비 스위트 + 자신)를 Error 메시지에 명시해 두어 디버깅 부담을 완화했다. 신규 spec 파일의 `readFileSync` 는 읽기 전용이라 파일시스템 위험이 없고, 공개 API 변경도 전부 추가적(additive)이라 기존 호출자에 영향이 없다. 전역 상태·환경 변수·네트워크·이벤트 축에서는 해당 사항이 없다.

## 위험도

NONE
