/**
 * 값이 `undefined` 인 키를 뺀 얕은 사본을 돌려준다 — PATCH 의 부분 본문을 로드한 엔티티에 `Object.assign` 하기 전에 쓴다.
 *
 * DTO 인스턴스는 보내지 않은 optional 필드도 `undefined` own property 로 갖는다(`target: ES2023` →
 * `useDefineForClassFields`). 그대로 병합하면 로드한 값이 `undefined` 로 덮여 **응답이 틀린다**. DB 는 TypeORM 이 undefined 를
 * 건너뛰어 무사하지만, nullable 이 아닌 컬럼은 응답에서 키가 사라지고 nullable 컬럼은 TypeORM 이 저장 뒤 undefined 를 null 로
 * 채워 거짓 null 이 실린다. 실제로 겪은 자리: `PATCH /triggers/:id` 응답의 `name`(키 부재), `PATCH /folders/:id` 응답의
 * `sortOrder`(키 부재) · 하위 폴더의 `parentId`(거짓 null).
 *
 * `null` 은 남긴다 — «값을 지운다» 는 명시적 요청이다. 얕게만 본다 — 중첩 객체 안의 `undefined` 는 그대로다.
 */
export function omitUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
