# 부작용(Side Effect) 리뷰

## 범위 확인

실질 코드/테스트 변경은 4개 파일이다.

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `AlertRuleDto.threshold: number → string`, `@ApiProperty({ example: 10 })` → `@ApiProperty({ type: String, example: '10.0000' })`.
2. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 신규 export `findNumericAsNumber`(+ 헬퍼 `readStringOption`/`collectNumericFields`/`collectDtoFieldTypes`) 추가. 기존 export `findSwaggerContractMismatches`(presence/null 두 축)는 실제로 무변경임을 소스 대조로 확인.
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 신규 함수를 저장소 전수(`SRC_ROOT`) 로 실행하는 테스트 + 대조군 6건 추가.
4. `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서/추적 갱신 (코드 아님).

나머지 33개 파일(file 6~38)은 직전 두 리뷰 라운드(`19_43_18`, `20_16_17`)와 consistency 라운드(`20_05_42`)의 산출물이 이번 changeset 에 커밋되어 딸려 온 리포트 파일이며, 이 저장소 관례(`review/**` 산출물 커밋)상 신규 코드 부작용의 대상이 아니다.

저장소를 뮤테이션하지 않았다 — `Read`/`Grep`/`git status --short` 만 사용했고, 대상 함수(`swagger-dto-contract-guard.ts`, `temp-fixture.ts`)는 전문을 직접 열어 대조했다.

## 발견사항

- **[INFO]** 신규 가드 축(`findNumericAsNumber`)이 이번 diff 범위(alerts 모듈)를 넘어 `dto/responses/**` 전역에 상시 강제된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findNumericAsNumber`, 297~349행대), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (`expect(findNumericAsNumber(collectTsFiles(SRC_ROOT))).toEqual([])`)
  - 상세: `findSwaggerContractMismatches`(기존 두 축)는 무변경이고 새 축만 추가됐다. 이 새 축은 `collectTsFiles(SRC_ROOT)` 로 backend `src` 전체를 스캔하므로, 이번 PR 이 고친 `alerts` 모듈뿐 아니라 앞으로 `/entities/`·`/dto/responses/` 경로에 `numeric`/`decimal` 컬럼을 `<Entity>Dto` 관례로 그대로 노출하는 **어떤 신규 응답 DTO 도** 이 테스트에 걸린다. 문서화된 의도(재발 방지)와 일치하므로 결함은 아니지만, "이 PR 의 직접 대상이 아닌 미래의 무관한 PR 이 이 공유 테스트 스위트 변경으로 인해 새로 실패할 수 있다"는 점에서 부작용 관점의 **공유 상태(CI 게이트) 확장**에 해당해 명시적으로 남긴다. 현재는 저장소 전수 확인 결과 위반 0건(테스트가 통과 상태)이라 즉각적 파급은 없다.
  - 제안: 조치 불요 — 의도된 설계이자 이미 `spec-draft-nullable-notation-followups.md` W2 항목으로 `spec/conventions/swagger.md` 성문화가 예정돼 있다. 참고용 기록.

- **[INFO]** `AlertRuleDto.threshold` 타입 변경은 공개 OpenAPI 인터페이스 변경이지만 저장소 내부 호출자·컴파일 영향은 없음을 실측 확인
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (필드 선언), `codebase/backend/src/modules/alerts/alerts.controller.ts` (`AlertRuleDto` 참조 지점)
  - 상세: `grep -rn AlertRuleDto codebase/backend/src codebase/backend/test codebase/frontend/src` 로 전수 확인한 결과, `AlertRuleDto` 는 `alerts.controller.ts` 의 `@ApiOkWrappedArrayResponse`/`@ApiCreatedWrappedResponse`/`@ApiOkWrappedResponse` 데코레이터 **인자**로만 쓰이고 함수 반환 타입 애노테이션·인스턴스화·타입 단언 어디에도 등장하지 않는다. 즉 `threshold: number → string` 필드 시그니처 변경이 `tsc` 컴파일이나 런타임 어느 쪽에도 저장소 내부 side effect 를 만들지 않는다(공개 API 계약 자체의 breaking 여부는 `api_contract`/`documentation` 리뷰가 이미 다뤘고 CHANGELOG 에 영향 문단이 보강돼 있음을 확인했다).
  - 제안: 없음 — 확인 완료.

- **[INFO]** 신규 테스트 픽스처(`withFiles`)는 OS 임시 디렉터리(`os.tmpdir()`)에 생성·삭제하며 저장소 트리를 건드리지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 의 신규 `describe('numeric 컬럼을 number 로 문서화한 응답 DTO', …)` 블록 (`withFiles` 호출 8곳)
  - 상세: `withFiles` 헬퍼(`codebase/backend/src/common/__test-utils__/temp-fixture.ts`, 이번 diff 로 수정된 파일 아님, pre-existing) 는 `fs.mkdtempSync(path.join(os.tmpdir(), prefix))` 로 격리된 tmpdir 을 만들고 콜백 종료 후 `finally` 블록에서 `fs.rmSync(dir, { recursive: true, force: true })` 로 정리한다. 새 테스트는 이 기존 헬퍼를 그대로 재사용할 뿐이며 저장소 파일을 쓰거나 지우지 않는다.
  - 제안: 없음. (참고: `withFiles` 내부에서 파일 쓰기 루프가 `try` 블록 **이전**에 있어 `mkdirSync`/`writeFileSync` 자체가 던지면 tmpdir 정리가 안 되는 잠재적 누수 경로가 있으나, 이는 이번 diff 가 수정하지 않은 기존 코드이고 이번 신규 픽스처 데이터로는 그 경로가 발현되지 않는다 — 참고로만 남기고 이번 diff 의 결함으로 집계하지 않음.)

- **[INFO]** 환경 변수·네트워크·전역 변수·이벤트/콜백 관련 부작용 없음
  - 상세: 4개 실질 변경 파일 전체에서 `process.env` 읽기/쓰기, 외부 HTTP/DB 호출, 모듈 스코프 mutable 전역 변수 추가, 이벤트 emit/구독 변경이 전혀 없다. 신규 module-level `const`(`ENTITY_DIR`, `RESPONSE_DTO_DIR`)는 불변 상수이며 export 되지 않는다.

## 요약

이번 changeset 의 실질 코드 변경은 (1) `AlertRuleDto.threshold` 필드 타입을 실제 wire 형태(`string`)에 맞춘 순수 문서/타입 애노테이션 정정과 (2) 그 결함 클래스를 되잡는 신규 정적 가드(`findNumericAsNumber`) 및 그 테스트뿐이다. `threshold` 변경은 저장소 내부 어디에서도 반환 타입으로 강제되지 않아 컴파일·런타임 side effect 가 없음을 grep 전수 확인으로 뒷받침했고, 신규 가드/테스트는 기존 tmpdir 픽스처 헬퍼를 재사용해 저장소 트리 밖에서만 파일을 생성·삭제한다. 유일하게 부작용 관점에서 의미 있게 남길 사항은 신규 가드가 alerts 모듈을 넘어 backend 전역 `dto/responses/**` 에 상시 CI 게이트로 확장 적용된다는 점인데, 이는 문서화된 의도적 설계이고 현재 위반 0건으로 즉각적 파급은 없다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백·기존 함수 시그니처(호출자 존재하는 것)의 파괴적 변경은 발견되지 않았다.

## 위험도

NONE
