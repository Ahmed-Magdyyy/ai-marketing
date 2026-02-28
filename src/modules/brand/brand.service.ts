import { BrandProfileModel, BrandProfile } from "./brand.model";
import { ApiError } from "../../shared/utils/ApiError";
import { ErrorCode, ArabicDialect } from "../../shared/types";
import { Types } from "mongoose";

export interface BrandDNAInput {
  colors?: string[];
  fonts?: string[];
  tone?: string;
  personality?: string;
  contentDialect?: ArabicDialect;
  uvp?: string;
  targetAudience?: {
    ageRange?: string;
    gender?: string;
    interests?: string[];
    painPoints?: string[];
    platforms?: string[];
  };
}

export interface CreateBrandInput {
  userId: Types.ObjectId | string;
  businessName: string;
  industry: string;
  description?: string;
  website?: string;
  targetMarket?: {
    country?: string;
    city?: string;
  };
  brandDNA?: BrandDNAInput;
}

export interface UpdateBrandInput {
  businessName?: string;
  industry?: string;
  description?: string;
  website?: string;
  targetMarket?: {
    country?: string;
    city?: string;
  };
  brandDNA?: Partial<BrandDNAInput>;
}

async function createBrand(input: CreateBrandInput): Promise<BrandProfile> {
  const {
    userId,
    businessName,
    industry,
    description,
    website,
    targetMarket,
    brandDNA,
  } = input;

  if (!businessName || !industry) {
    throw new ApiError(400, ErrorCode.ValidationError);
  }

  const newBrand = await BrandProfileModel.create({
    userId,
    businessName,
    industry,
    description,
    website,
    targetMarket,
    brandDNA,
  });

  return newBrand;
}

async function updateBrand(
  userId: Types.ObjectId | string,
  brandId: string,
  updateData: UpdateBrandInput,
): Promise<BrandProfile> {
  if (!brandId || brandId.length !== 24) {
    throw new ApiError(400, ErrorCode.NotFound);
  }

  const updatedBrand = await BrandProfileModel.findOneAndUpdate(
    { _id: brandId, userId },
    { $set: updateData },
    { new: true, runValidators: true },
  ).lean();

  if (!updatedBrand) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  return updatedBrand as BrandProfile;
}

async function getBrand(
  userId: Types.ObjectId | string,
  brandId: string,
): Promise<BrandProfile> {
  if (!brandId || brandId.length !== 24) {
    throw new ApiError(400, ErrorCode.NotFound);
  }

  const brand = await BrandProfileModel.findOne({
    _id: brandId,
  }).lean();

  if (!brand) {
    throw new ApiError(404, ErrorCode.NotFound);
  }

  if (brand.userId.toString() !== userId.toString()) {
    throw new ApiError(403, ErrorCode.Unauthorized);
  }

  return brand as BrandProfile;
}

export const brandService = {
  createBrand,
  updateBrand,
  getBrand,
};
